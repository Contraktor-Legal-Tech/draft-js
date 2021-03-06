/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorContents.react
 * @typechecks
 * 
 */

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DraftEditorBlocks = require('./DraftEditorBlocks.react');
var EditorState = require('./EditorState');
var React = require('react');
var nullthrows = require('fbjs/lib/nullthrows');

/**
 * `DraftEditorContents` is the container component for all block components
 * rendered for a `DraftEditor`. It is optimized to aggressively avoid
 * re-rendering blocks whenever possible.
 *
 * This component is separate from `DraftEditor` because certain props
 * (for instance, ARIA props) must be allowed to update without affecting
 * the contents of the editor.
 */

var DraftEditorContents = (function (_React$Component) {
  _inherits(DraftEditorContents, _React$Component);

  function DraftEditorContents() {
    _classCallCheck(this, DraftEditorContents);

    _get(Object.getPrototypeOf(DraftEditorContents.prototype), 'constructor', this).apply(this, arguments);
  }

  _createClass(DraftEditorContents, [{
    key: 'shouldComponentUpdate',
    value: function shouldComponentUpdate(nextProps) {
      var prevEditorState = this.props.editorState;
      var nextEditorState = nextProps.editorState;

      var prevDirectionMap = prevEditorState.getDirectionMap();
      var nextDirectionMap = nextEditorState.getDirectionMap();

      // Text direction has changed for one or more blocks. We must re-render.
      if (prevDirectionMap !== nextDirectionMap) {
        return true;
      }

      var didHaveFocus = prevEditorState.getSelection().getHasFocus();
      var nowHasFocus = nextEditorState.getSelection().getHasFocus();

      if (didHaveFocus !== nowHasFocus) {
        return true;
      }

      var nextNativeContent = nextEditorState.getNativelyRenderedContent();

      var wasComposing = prevEditorState.isInCompositionMode();
      var nowComposing = nextEditorState.isInCompositionMode();

      // If the state is unchanged or we're currently rendering a natively
      // rendered state, there's nothing new to be done.
      if (prevEditorState === nextEditorState || nextNativeContent !== null && nextEditorState.getCurrentContent() === nextNativeContent || wasComposing && nowComposing) {
        return false;
      }

      var prevContent = prevEditorState.getCurrentContent();
      var nextContent = nextEditorState.getCurrentContent();
      var prevDecorator = prevEditorState.getDecorator();
      var nextDecorator = nextEditorState.getDecorator();
      return wasComposing !== nowComposing || prevContent !== nextContent || prevDecorator !== nextDecorator || nextEditorState.mustForceSelection();
    }
  }, {
    key: 'render',
    value: function render() {
      var _props = this.props;
      var blockRenderMap = _props.blockRenderMap;
      var blockRendererFn = _props.blockRendererFn;
      var blockStyleFn = _props.blockStyleFn;
      var customStyleMap = _props.customStyleMap;
      var editorState = _props.editorState;

      var content = editorState.getCurrentContent();
      var selection = editorState.getSelection();
      var forceSelection = editorState.mustForceSelection();
      var decorator = editorState.getDecorator();
      var directionMap = nullthrows(editorState.getDirectionMap());
      var blockMapTree = content.getBlockDescendants();
      var blockMap = blockMapTree.getIn(['__ROOT__', 'firstLevelBlocks']);

      return React.createElement(DraftEditorBlocks, {
        type: 'contents',
        selection: selection,
        forceSelection: forceSelection,
        decorator: decorator,
        directionMap: directionMap,
        blockMap: blockMap,
        blockMapTree: blockMapTree,
        blockStyleFn: blockStyleFn,
        blockRendererFn: blockRendererFn,
        blockRenderMap: blockRenderMap,
        customStyleMap: customStyleMap,
        getBlockTree: editorState.getBlockTree.bind(editorState),
        getBlockChildren: content.getBlockChildren.bind(content),
        getBlockDescendants: content.getBlockDescendants.bind(content)
      });
    }
  }]);

  return DraftEditorContents;
})(React.Component);

module.exports = DraftEditorContents;