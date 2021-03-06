/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule splitBlockInContentState
 * @typechecks
 * 
 */

'use strict';

var _immutable = require('immutable');

var generateNestedKey = require('./generateNestedKey');
var generateRandomKey = require('./generateRandomKey');
var invariant = require('fbjs/lib/invariant');

function splitBlockInContentState(contentState, selectionState) {
  !selectionState.isCollapsed() ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Selection range must be collapsed.') : invariant(false) : undefined;

  var key = selectionState.getAnchorKey();
  var offset = selectionState.getAnchorOffset();
  var blockMap = contentState.getBlockMap();
  var blockToSplit = blockMap.get(key);
  var parentKey = blockToSplit.getParentKey();

  var text = blockToSplit.getText();
  var chars = blockToSplit.getCharacterList();

  var blockAbove = blockToSplit.merge({
    text: text.slice(0, offset),
    characterList: chars.slice(0, offset)
  });

  var keyBelow = parentKey ? generateNestedKey(parentKey) : generateRandomKey();

  var blockBelow = blockAbove.merge({
    key: keyBelow,
    text: text.slice(offset),
    characterList: chars.slice(offset),
    data: (0, _immutable.Map)()
  });

  var blocksBefore = blockMap.toSeq().takeUntil(function (v) {
    return v === blockToSplit;
  });
  var blocksAfter = blockMap.toSeq().skipUntil(function (v) {
    return v === blockToSplit;
  }).rest();
  var newBlocks = blocksBefore.concat([[blockAbove.getKey(), blockAbove], [blockBelow.getKey(), blockBelow]], blocksAfter).toOrderedMap();

  return contentState.merge({
    blockMap: newBlocks,
    selectionBefore: selectionState,
    selectionAfter: selectionState.merge({
      anchorKey: keyBelow,
      anchorOffset: 0,
      focusKey: keyBelow,
      focusOffset: 0,
      isBackward: false
    })
  });
}

module.exports = splitBlockInContentState;