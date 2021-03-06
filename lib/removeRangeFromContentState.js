/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule removeRangeFromContentState
 * 
 */

'use strict';

var Immutable = require('immutable');

function removeRangeFromContentState(contentState, selectionState) {
  if (selectionState.isCollapsed()) {
    return contentState;
  }

  var blockMap = contentState.getBlockMap();
  var startKey = selectionState.getStartKey();
  var startOffset = selectionState.getStartOffset();
  var endKey = selectionState.getEndKey();
  var endOffset = selectionState.getEndOffset();

  var startBlock = blockMap.get(startKey);
  var endBlock = blockMap.get(endKey);

  var nextBlock = contentState.getBlockAfter(endKey);
  var nextBlockKey = nextBlock ? nextBlock.getKey() : '';

  /*
   * when dealing with selection ranges across nested blocks we need to be able to
   * identify what is the most common shared parent beteween sibling blocks
   *
   * example
   *
   * li > bq > unstyled
   * li > bq > header-one
   *
   * the topMosCommonParentKey would be the key for `li > bq`
   */
  var topMostCommonParentKey = nextBlockKey.split('/').reduce(function (value, key, index) {
    if (endKey.indexOf(key) !== -1) {
      value.push(key);
    }
    return value;
  }, []).join('/');

  var characterList;

  if (startBlock === endBlock) {
    characterList = removeFromList(startBlock.getCharacterList(), startOffset, endOffset);
  } else {
    characterList = startBlock.getCharacterList().slice(0, startOffset).concat(endBlock.getCharacterList().slice(endOffset));
  }

  var modifiedStart = startBlock.merge({
    text: startBlock.getText().slice(0, startOffset) + endBlock.getText().slice(endOffset),
    characterList: characterList
  });

  var newBlocks = blockMap.toSeq().skipUntil(function (_, k) {
    return k === startKey;
  }).takeUntil(function (_, k) {
    return k === endKey;
  }).filterNot(function (_, k) {
    return topMostCommonParentKey.indexOf(k) !== -1;
  }).concat(Immutable.Map([[endKey, null]])).map(function (_, k) {
    return k === startKey ? modifiedStart : null;
  });

  blockMap = blockMap.merge(newBlocks).filter(function (block) {
    return !!block;
  });

  return contentState.merge({
    blockMap: blockMap,
    selectionBefore: selectionState,
    selectionAfter: selectionState.merge({
      anchorKey: startKey,
      anchorOffset: startOffset,
      focusKey: startKey,
      focusOffset: startOffset,
      isBackward: false
    })
  });
}

/**
 * Maintain persistence for target list when removing characters on the
 * head and tail of the character list.
 */
function removeFromList(targetList, startOffset, endOffset) {
  if (startOffset === 0) {
    while (startOffset < endOffset) {
      targetList = targetList.shift();
      startOffset++;
    }
  } else if (endOffset === targetList.count()) {
    while (endOffset > startOffset) {
      targetList = targetList.pop();
      endOffset--;
    }
  } else {
    var head = targetList.slice(0, startOffset);
    var tail = targetList.slice(endOffset);
    targetList = head.concat(tail).toList();
  }
  return targetList;
}

module.exports = removeRangeFromContentState;