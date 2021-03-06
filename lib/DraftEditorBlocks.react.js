/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DraftEditorBlocks.react
 * @typechecks
 * 
 */

/**
 * `DraftEditorBlocks` is the container component for all block components
 * rendered for a `DraftEditor`. It is optimized to aggressively avoid
 * re-rendering blocks whenever possible.
 *
 * This component is separate from `DraftEditor` because certain props
 * (for instance, ARIA props) must be allowed to update without affecting
 * the contents of the editor.
 */
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DraftEditorBlock = require('./DraftEditorBlock.react');
var DraftOffsetKey = require('./DraftOffsetKey');
var React = require('react');

var cx = require('fbjs/lib/cx');
var joinClasses = require('fbjs/lib/joinClasses');
var nullthrows = require('fbjs/lib/nullthrows');

var DraftEditorBlocks = (function (_React$Component) {
  _inherits(DraftEditorBlocks, _React$Component);

  function DraftEditorBlocks() {
    _classCallCheck(this, DraftEditorBlocks);

    _get(Object.getPrototypeOf(DraftEditorBlocks.prototype), 'constructor', this).apply(this, arguments);
  }

  /**
   * Provide default styling for list items. This way, lists will be styled with
   * proper counters and indentation even if the caller does not specify
   * their own styling at all. If more than five levels of nesting are needed,
   * the necessary CSS classes can be provided via `blockStyleFn` configuration.
   */

  _createClass(DraftEditorBlocks, [{
    key: 'render',
    value: function render() {
      var _this = this;

      var _props = this.props;
      var type = _props.type;
      var blockRenderMap = _props.blockRenderMap;
      var blockRendererFn = _props.blockRendererFn;
      var blockStyleFn = _props.blockStyleFn;
      var customStyleMap = _props.customStyleMap;
      var blockMap = _props.blockMap;
      var blockMapTree = _props.blockMapTree;
      var selection = _props.selection;
      var forceSelection = _props.forceSelection;
      var decorator = _props.decorator;
      var directionMap = _props.directionMap;
      var getBlockTree = _props.getBlockTree;
      var getBlockChildren = _props.getBlockChildren;
      var getBlockDescendants = _props.getBlockDescendants;

      var blocks = [];
      var currentWrapperElement = null;
      var currentWrapperTemplate = null;
      var currentDepth = null;
      var currentWrappedBlocks = undefined;
      var key = undefined,
          blockType = undefined,
          child = undefined,
          childProps = undefined,
          wrapperTemplate = undefined;

      blockMap.forEach(function (block) {
        key = block.getKey();
        blockType = block.getType();

        var customRenderer = blockRendererFn(block);
        var CustomComponent = undefined,
            customProps = undefined,
            customEditable = undefined;
        if (customRenderer) {
          CustomComponent = customRenderer.component;
          customProps = customRenderer.props;
          customEditable = customRenderer.editable;
        }

        var direction = directionMap.get(key);
        var offsetKey = DraftOffsetKey.encode(key, 0, 0);
        var blockChildren = blockMapTree.getIn([key, 'firstLevelBlocks']);

        var componentProps = {
          block: block,
          blockProps: customProps,
          customStyleMap: customStyleMap,
          decorator: decorator,
          direction: direction,
          directionMap: directionMap,
          forceSelection: forceSelection,
          key: key,
          offsetKey: offsetKey,
          selection: selection,
          blockRenderMap: blockRenderMap,
          blockRendererFn: blockRendererFn,
          blockStyleFn: blockStyleFn,
          blockMapTree: blockMapTree,
          blockMap: blockChildren,
          getBlockTree: getBlockTree,
          getBlockChildren: getBlockChildren,
          getBlockDescendants: getBlockDescendants,
          DraftEditorBlocks: DraftEditorBlocks,
          tree: getBlockTree(key)
        };

        // Block render map must have a configuration specified for this
        // block type.
        var configForType = nullthrows(blockRenderMap.get(blockType));

        wrapperTemplate = configForType.wrapper;

        var useNewWrapper = wrapperTemplate !== currentWrapperTemplate;

        var Element = blockRenderMap.get(blockType).element || blockRenderMap.get('unstyled').element;

        var depth = block.getDepth();
        var className = blockStyleFn(block);

        // List items are special snowflakes, since we handle nesting and
        // counters manually.
        if (Element === 'li') {
          var shouldResetCount = useNewWrapper || currentDepth === null || depth > currentDepth;
          className = joinClasses(className, getListItemClasses(blockType, depth, shouldResetCount, direction));
        }

        var Component = CustomComponent || DraftEditorBlock;
        childProps = {
          className: className,
          'data-block': true,
          'data-editor': _this.props.editorKey,
          'data-offset-key': offsetKey,
          key: key
        };
        if (customEditable !== undefined) {
          childProps = _extends({}, childProps, {
            contentEditable: customEditable,
            suppressContentEditableWarning: true
          });
        }

        child = React.createElement(Element, childProps, React.createElement(Component, componentProps));

        if (wrapperTemplate) {
          if (useNewWrapper) {
            currentWrappedBlocks = [];
            currentWrapperElement = React.cloneElement(wrapperTemplate, {
              key: key + '-wrap',
              'data-offset-key': offsetKey
            }, currentWrappedBlocks);
            currentWrapperTemplate = wrapperTemplate;
            blocks.push(currentWrapperElement);
          }
          currentDepth = block.getDepth();
          nullthrows(currentWrappedBlocks).push(child);
        } else {
          currentWrappedBlocks = null;
          currentWrapperElement = null;
          currentWrapperTemplate = null;
          currentDepth = null;
          blocks.push(child);
        }
      });

      var dataContents = type === 'contents' ? true : null;
      var dataBlocks = dataContents ? null : true;

      return(
        // data-contents will be true for the root level block otherwise
        // it will just be a block container
        React.createElement(
          'div',
          { 'data-contents': dataContents, 'data-blocks': dataBlocks },
          blocks
        )
      );
    }
  }]);

  return DraftEditorBlocks;
})(React.Component);

function getListItemClasses(type, depth, shouldResetCount, direction) {
  return cx({
    'public/DraftStyleDefault/unorderedListItem': type === 'unordered-list-item',
    'public/DraftStyleDefault/orderedListItem': type === 'ordered-list-item',
    'public/DraftStyleDefault/reset': shouldResetCount,
    'public/DraftStyleDefault/depth0': depth === 0,
    'public/DraftStyleDefault/depth1': depth === 1,
    'public/DraftStyleDefault/depth2': depth === 2,
    'public/DraftStyleDefault/depth3': depth === 3,
    'public/DraftStyleDefault/depth4': depth === 4,
    'public/DraftStyleDefault/listLTR': direction === 'LTR',
    'public/DraftStyleDefault/listRTL': direction === 'RTL'
  });
}

module.exports = DraftEditorBlocks;