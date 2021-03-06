/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getContentStateFragment
 * @typechecks
 * 
 */

'use strict';

var randomizeBlockMapKeys = require('./randomizeBlockMapKeys');
var removeEntitiesAtEdges = require('./removeEntitiesAtEdges');

function getContentStateFragment(contentState, selectionState) {
  var startKey = selectionState.getStartKey();
  var startOffset = selectionState.getStartOffset();
  var endKey = selectionState.getEndKey();
  var endOffset = selectionState.getEndOffset();

  // Edge entities should be stripped to ensure that we don't preserve
  // invalid partial entities when the fragment is reused. We do, however,
  // preserve entities that are entirely within the selection range.
  var contentWithoutEdgeEntities = removeEntitiesAtEdges(contentState, selectionState);

  var blockMap = contentWithoutEdgeEntities.getBlockMap();

  var randomizedBlockMapKeys = randomizeBlockMapKeys(blockMap);

  var randomizedBlockKeys = randomizedBlockMapKeys.keySeq();
  var blockKeys = blockMap.keySeq();

  var startIndex = blockKeys.indexOf(startKey);
  var endIndex = blockKeys.indexOf(endKey) + 1;

  var slice = randomizedBlockMapKeys.slice(startIndex, endIndex).map(function (block, blockKey) {
    var keyIndex = randomizedBlockKeys.indexOf(blockKey);

    var text = block.getText();
    var chars = block.getCharacterList();

    if (startKey === endKey) {
      return block.merge({
        text: text.slice(startOffset, endOffset),
        characterList: chars.slice(startOffset, endOffset)
      });
    }

    if (keyIndex === startIndex) {
      return block.merge({
        text: text.slice(startOffset),
        characterList: chars.slice(startOffset)
      });
    }

    if (keyIndex === endIndex) {
      return block.merge({
        text: text.slice(0, endOffset),
        characterList: chars.slice(0, endOffset)
      });
    }

    return block;
  });

  return slice.toOrderedMap();
}

module.exports = getContentStateFragment;