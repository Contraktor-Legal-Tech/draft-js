/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule convertFromHTMLToContentBlocks
 * @typechecks
 * 
 */

'use strict';

var CharacterMetadata = require('./CharacterMetadata');
var ContentBlock = require('./ContentBlock');
var DefaultDraftBlockRenderMap = require('./DefaultDraftBlockRenderMap');
var DraftEntity = require('./DraftEntity');
var Immutable = require('immutable');
var URI = require('fbjs/lib/URI');

var generateNestedKey = require('./generateNestedKey');
var generateRandomKey = require('./generateRandomKey');
var getSafeBodyFromHTML = require('./getSafeBodyFromHTML');
var invariant = require('fbjs/lib/invariant');
var nullthrows = require('fbjs/lib/nullthrows');
var sanitizeDraftText = require('./sanitizeDraftText');

var List = Immutable.List;
var OrderedSet = Immutable.OrderedSet;
var Repeat = Immutable.Repeat;

var NBSP = '&nbsp;';
var SPACE = ' ';

// Arbitrary max indent
var MAX_DEPTH = 4;

// used for replacing characters in HTML
var REGEX_CR = new RegExp('\r', 'g');
var REGEX_LF = new RegExp('\n', 'g');
var REGEX_NBSP = new RegExp(NBSP, 'g');

// Block tag flow is different because LIs do not have
// a deterministic style ;_;
var inlineTags = {
  b: 'BOLD',
  code: 'CODE',
  del: 'STRIKETHROUGH',
  em: 'ITALIC',
  i: 'ITALIC',
  s: 'STRIKETHROUGH',
  strike: 'STRIKETHROUGH',
  strong: 'BOLD',
  u: 'UNDERLINE'
};

var lastBlock;

function getEmptyChunk() {
  return {
    text: '',
    inlines: [],
    entities: [],
    blocks: [],
    keys: []
  };
}

function getWhitespaceChunk(inEntity) {
  var entities = new Array(1);
  if (inEntity) {
    entities[0] = inEntity;
  }
  return {
    text: SPACE,
    inlines: [OrderedSet()],
    entities: entities,
    blocks: [],
    keys: []
  };
}

function getSoftNewlineChunk() {
  return {
    text: '\n',
    inlines: [OrderedSet()],
    entities: new Array(1),
    blocks: [],
    keys: []
  };
}

function getBlockDividerChunk(block, depth) {
  var key = arguments.length <= 2 || arguments[2] === undefined ? generateRandomKey() : arguments[2];

  return {
    text: '\r',
    inlines: [OrderedSet()],
    entities: new Array(1),
    blocks: [{
      type: block,
      depth: Math.max(0, Math.min(MAX_DEPTH, depth))
    }],
    keys: key ? [key] : []
  };
}

function getListBlockType(tag, lastList) {
  if (tag === 'li') {
    return lastList === 'ol' ? 'ordered-list-item' : 'unordered-list-item';
  }
  return null;
}

function getBlockMapSupportedTags(blockRenderMap) {
  // Some blocks must be treated as unstyled when not present on the blockRenderMap
  var unstyledElement = blockRenderMap.get('unstyled').element;
  var defaultUnstyledSet = new Immutable.Set(['p']);
  var userDefinedSupportedBlockSet = blockRenderMap.map(function (config) {
    return config.element;
  }).valueSeq().toSet();

  return defaultUnstyledSet.merge(userDefinedSupportedBlockSet).filter(function (tag) {
    return tag !== unstyledElement;
  }).toArray().sort();
}

// custom element conversions
function getMultiMatchedType(tag, lastList, multiMatchExtractor) {
  if (tag) {
    for (var ii = 0; ii < multiMatchExtractor.length; ii++) {
      var matchType = multiMatchExtractor[ii](tag, lastList);
      if (matchType) {
        return matchType;
      }
    }
  }
  return null;
}

function getBlockTypeForTag(tag, lastList, blockRenderMap) {
  var matchedTypes = blockRenderMap.filter(function (config) {
    return config.element === tag || config.wrapper === tag;
  }).keySeq().toSet().toArray().sort();

  // if we dont have any matched type, return unstyled
  // if we have one matched type return it
  // if we have multi matched types use the multi-match function to gather type
  switch (matchedTypes.length) {
    case 0:
      return 'unstyled';
    case 1:
      return matchedTypes[0];
    default:
      return getMultiMatchedType(tag, lastList, [getListBlockType]) || 'unstyled';
  }
}

function processInlineTag(tag, node, currentStyle) {
  var styleToCheck = inlineTags[tag];
  if (styleToCheck) {
    currentStyle = currentStyle.add(styleToCheck).toOrderedSet();
  } else if (node instanceof HTMLElement) {
    (function () {
      var htmlElement = node;
      currentStyle = currentStyle.withMutations(function (style) {
        if (htmlElement.style.fontWeight === 'bold') {
          style.add('BOLD');
        }

        if (htmlElement.style.fontStyle === 'italic') {
          style.add('ITALIC');
        }

        if (htmlElement.style.textDecoration === 'underline') {
          style.add('UNDERLINE');
        }

        if (htmlElement.style.textDecoration === 'line-through') {
          style.add('STRIKETHROUGH');
        }
      }).toOrderedSet();
    })();
  }
  return currentStyle;
}

function joinChunks(A, B) {
  var hasNestedBlock = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

  // Sometimes two blocks will touch in the DOM and we need to strip the
  // extra delimiter to preserve niceness.
  var lastInA = A.text.slice(-1);
  var firstInB = B.text.slice(0, 1);

  if (lastInA === '\r' && firstInB === '\r' && !hasNestedBlock) {
    A.text = A.text.slice(0, -1);
    A.inlines.pop();
    A.entities.pop();
    A.blocks.pop();
    A.keys.pop();
  }

  // Kill whitespace after blocks
  if (lastInA === '\r') {
    if (B.text === SPACE || B.text === '\n') {
      return A;
    } else if (firstInB === SPACE || firstInB === '\n') {
      B.text = B.text.slice(1);
      B.inlines.shift();
      B.entities.shift();
    }
  }

  return {
    text: A.text + B.text,
    inlines: A.inlines.concat(B.inlines),
    entities: A.entities.concat(B.entities),
    blocks: A.blocks.concat(B.blocks),
    keys: A.keys.concat(B.keys)
  };
}

/**
 * Check to see if we have anything like <p> <blockquote> <h1>... to create
 * block tags from. If we do, we can use those and ignore <div> tags. If we
 * don't, we can treat <div> tags as meaningful (unstyled) blocks.
 */
function containsSemanticBlockMarkup(html, blockTags) {
  return blockTags.some(function (tag) {
    return html.indexOf('<' + tag) !== -1;
  });
}

function hasValidLinkText(link) {
  !(link instanceof HTMLAnchorElement) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Link must be an HTMLAnchorElement.') : invariant(false) : undefined;
  var protocol = link.protocol;
  return protocol === 'http:' || protocol === 'https:';
}

function genFragment(node, inlineStyle, lastList, inBlock, blockTags, depth, blockRenderMap, inEntity, blockKey) {
  var nodeName = node.nodeName.toLowerCase();
  var newBlock = false;
  var nextBlockType = 'unstyled';
  var lastLastBlock = lastBlock;
  var isValidBlock = blockTags.indexOf(nodeName) !== -1;
  var isListContainer = nodeName === 'ul' || nodeName === 'ol';
  var inBlockType = getBlockTypeForTag(inBlock, lastList, blockRenderMap);

  // Base Case
  if (nodeName === '#text') {
    var text = node.textContent;
    if (text.trim() === '' && inBlock !== 'pre') {
      return getWhitespaceChunk(inEntity);
    }
    if (inBlock !== 'pre') {
      // Can't use empty string because MSWord
      text = text.replace(REGEX_LF, SPACE);
    }

    // save the last block so we can use it later
    lastBlock = nodeName;

    return {
      text: text,
      inlines: Array(text.length).fill(inlineStyle),
      entities: Array(text.length).fill(inEntity),
      blocks: [],
      keys: []
    };
  }

  // save the last block so we can use it later
  lastBlock = nodeName;

  // BR tags
  if (nodeName === 'br') {
    if (lastLastBlock === 'br' && (!inBlock || inBlockType === 'unstyled')) {
      return getBlockDividerChunk('unstyled', depth, blockKey);
    }
    return getSoftNewlineChunk();
  }

  var chunk = getEmptyChunk();
  var newChunk = null;

  // Inline tags
  inlineStyle = processInlineTag(nodeName, node, inlineStyle);

  // Handle lists
  if (isListContainer) {
    if (lastList) {
      depth += 1;
    }
    lastList = nodeName;
  }

  var blockType = getBlockTypeForTag(nodeName, lastList, blockRenderMap);
  var inBlockConfig = blockRenderMap.get(inBlockType);

  if (lastList && inBlock === 'li' && nodeName === 'li') {
    chunk = getBlockDividerChunk(blockType, depth, blockKey);
    newBlock = !inBlockConfig.nestingEnabled;
    inBlock = nodeName;
    nextBlockType = lastList === 'ul' ? 'unordered-list-item' : 'ordered-list-item';
  } else if ((!inBlock || inBlockConfig.nestingEnabled) && blockTags.indexOf(nodeName) !== -1) {
    chunk = getBlockDividerChunk(blockType, depth, blockKey);
    newBlock = !inBlockConfig.nestingEnabled;
    inBlock = nodeName;
  }

  // Recurse through children
  var child = node.firstChild;
  if (child != null) {
    nodeName = child.nodeName.toLowerCase();
  }

  var entityId = null;
  var href = null;
  var hasNestingEnabled = inBlockConfig && inBlockConfig.nestingEnabled;

  while (child) {
    if (nodeName === 'a' && child.href && hasValidLinkText(child)) {
      href = new URI(child.href).toString();
      entityId = DraftEntity.create('LINK', 'MUTABLE', { url: href });
    } else {
      entityId = undefined;
    }

    // if we are on an invalid block we can re-use the key since it wont generate a block
    isValidBlock = blockTags.indexOf(nodeName) !== -1;

    var insideANestableBlock = blockKey && chunk.keys.indexOf(blockKey) !== -1 && lastBlock && blockRenderMap.get(lastBlock) && blockRenderMap.get(lastBlock).nestingEnabled;

    var chunkKey = blockKey && (hasNestingEnabled || insideANestableBlock) ? isValidBlock ? generateNestedKey(blockKey) : blockKey : isValidBlock ? generateRandomKey() : '';

    newChunk = genFragment(child, inlineStyle, lastList, inBlock, blockTags, depth, blockRenderMap, entityId || inEntity, chunkKey);

    if (isValidBlock && !hasNestingEnabled) {
      // check to see if we have a valid parent that could adopt this child
      var directParent = child.parentNode;

      while (!hasNestingEnabled && directParent) {
        if (directParent) {
          blockType = getBlockTypeForTag(nodeName, lastList, blockRenderMap);
          var parentBlockType = getBlockTypeForTag(directParent.nodeName.toLowerCase(), lastList, blockRenderMap);
          var parentBlockConfig = blockRenderMap.get(parentBlockType);

          hasNestingEnabled = parentBlockConfig && parentBlockConfig.nestingEnabled;
        }

        directParent = directParent && directParent.parentNode ? directParent.parentNode : null;
      }
    }

    chunk = joinChunks(chunk, newChunk, hasNestingEnabled);
    var sibling = child.nextSibling;

    // Put in a newline to break up blocks inside blocks
    if (sibling && inBlock && isValidBlock && chunkKey.split('/').length === 1 // not nested element or invalid
    ) {
        chunk = joinChunks(chunk, getSoftNewlineChunk());
      }
    if (sibling) {
      nodeName = sibling.nodeName.toLowerCase();
    }
    child = sibling;
  }

  if (newBlock) {
    chunkKey = blockKey && hasNestingEnabled ? generateNestedKey(blockKey) : generateRandomKey();
    chunk = joinChunks(chunk, getBlockDividerChunk(nextBlockType, depth, chunkKey));
  }

  return chunk;
}

function getChunkForHTML(html, DOMBuilder, blockRenderMap) {
  html = html.trim().replace(REGEX_CR, '').replace(REGEX_NBSP, SPACE);

  var supportedBlockTags = getBlockMapSupportedTags(blockRenderMap);

  var safeBody = DOMBuilder(html);
  if (!safeBody) {
    return null;
  }
  lastBlock = null;

  // Sometimes we aren't dealing with content that contains nice semantic
  // tags. In this case, use divs to separate everything out into paragraphs
  // and hope for the best.
  var workingBlocks = containsSemanticBlockMarkup(html, supportedBlockTags) ? supportedBlockTags : ['div'];

  // Start with -1 block depth to offset the fact that we are passing in a fake
  // UL block to start with.
  var chunk = genFragment(safeBody, OrderedSet(), 'ul', null, workingBlocks, -1, blockRenderMap);

  // join with previous block to prevent weirdness on paste
  if (chunk.text.indexOf('\r') === 0) {
    chunk = {
      text: chunk.text.slice(1),
      inlines: chunk.inlines.slice(1),
      entities: chunk.entities.slice(1),
      blocks: chunk.blocks,
      keys: chunk.keys
    };
  }

  // Kill block delimiter at the end
  if (chunk.text.slice(-1) === '\r') {
    chunk.text = chunk.text.slice(0, -1);
    chunk.inlines = chunk.inlines.slice(0, -1);
    chunk.entities = chunk.entities.slice(0, -1);
    chunk.blocks.pop();
  }

  // If we saw no block tags, put an unstyled one in
  if (chunk.blocks.length === 0) {
    chunk.blocks.push({ type: 'unstyled', depth: 0 });
  }

  // Sometimes we start with text that isn't in a block, which is then
  // followed by blocks. Need to fix up the blocks to add in
  // an unstyled block for this content
  if (chunk.text.split('\r').length === chunk.blocks.length + 1) {
    chunk.blocks.unshift({ type: 'unstyled', depth: 0 });
  }

  return chunk;
}

function convertFromHTMLtoContentBlocks(html) {
  var DOMBuilder = arguments.length <= 1 || arguments[1] === undefined ? getSafeBodyFromHTML : arguments[1];
  var blockRenderMap = arguments.length <= 2 || arguments[2] === undefined ? DefaultDraftBlockRenderMap : arguments[2];

  // Be ABSOLUTELY SURE that the dom builder you pass here won't execute
  // arbitrary code in whatever environment you're running this in. For an
  // example of how we try to do this in-browser, see getSafeBodyFromHTML.
  var chunk = getChunkForHTML(html, DOMBuilder, blockRenderMap);

  if (chunk == null) {
    return null;
  }
  var start = 0;

  var contentBlocks = chunk.text.split('\r').map(function (textBlock, ii) {
    // Make absolutely certain that our text is acceptable.
    textBlock = sanitizeDraftText(textBlock);
    var end = start + textBlock.length;
    var inlines = nullthrows(chunk).inlines.slice(start, end);
    var entities = nullthrows(chunk).entities.slice(start, end);
    var characterList = List(inlines.map(function (style, ii) {
      var data = { style: style, entity: null };
      if (entities[ii]) {
        data.entity = entities[ii];
      }
      return CharacterMetadata.create(data);
    }));
    var key = nullthrows(chunk).keys[ii];
    start = end + 1;

    var blockType = nullthrows(chunk).blocks[ii].type;
    var blockConfig = blockRenderMap.get(blockType);
    var nextChunkKey = nullthrows(chunk).keys[ii + 1];
    var hasChildren = key && nextChunkKey && nextChunkKey.indexOf(key + '/') !== -1;

    if (blockConfig && blockConfig.nestingEnabled && hasChildren) {
      var character = '';
      var blockKey = key || generateRandomKey();

      // if we have a valid block that support nesting, that also has children
      // we should make sure that it's text is converted to an unstyled element
      // since blocks can only either have text or children an never both
      if (hasChildren && textBlock) {
        return [new ContentBlock({
          key: blockKey,
          type: blockType,
          depth: nullthrows(chunk).blocks[ii].depth,
          text: character,
          characterList: List(Repeat(CharacterMetadata.create(), character.length))
        }), new ContentBlock({
          key: generateNestedKey(blockKey),
          type: 'unstyled',
          text: textBlock,
          characterList: characterList
        })];
      }
    }

    return new ContentBlock({
      key: key,
      type: blockType,
      depth: nullthrows(chunk).blocks[ii].depth,
      text: textBlock,
      characterList: characterList
    });
  });

  // we need to flatten the array
  return contentBlocks.reduce(function (a, b) {
    return a.concat(b);
  }, []);
}

module.exports = convertFromHTMLtoContentBlocks;