/*!
 * dragtable
 *
 * @Version 1.0.2
 *
 * Copyright (c) 2010, Andres Koetter akottr@gmail.com
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Inspired by the the dragtable from Dan Vanderkam (danvk.org/dragtable/)
 * Thanks to the jquery and jqueryui comitters
 * 
 * Any comment, bug report, feature-request is welcome
 * Feel free to contact me.
 */

/* TOKNOW:
 * For IE7 you need this css rule:
 * table {
 *   border-collapse: collapse;
 * }
 * Or take a clean reset.css (see http://meyerweb.com/eric/tools/css/reset/)
 */

/* TODO: investigate
 * Does not work properly with css rule:
 * html {
 *      overflow: -moz-scrollbars-vertical;
 *  }
 * Workaround:
 * Fixing Firefox issues by scrolling down the page
 * http://stackoverflow.com/questions/2451528/jquery-ui-sortable-scroll-helper-element-offset-firefox-issue
 *
 * var start = $.noop;
 * var beforeStop = $.noop;
 * if($.browser.mozilla) {
 * var start = function (event, ui) {
 *               if( ui.helper !== undefined )
 *                 ui.helper.css('position','absolute').css('margin-top', $(window).scrollTop() );
 *               }
 * var beforeStop = function (event, ui) {
 *              if( ui.offset !== undefined )
 *                ui.helper.css('margin-top', 0);
 *              }
 * }
 *
 * and pass this as start and stop function to the sortable initialisation
 * start: start,
 * beforeStop: beforeStop
 */

/* TODO: fix it
 * jqueryui sortable Ticket #4482
 * Hotfixed it, but not very nice (deprecated api)
 * if(!p.height() || (jQuery.browser.msie && jQuery.browser.version.match('^7|^6'))) { p.height(self.currentItem.innerHeight() - parseInt(self.currentItem.css('paddingTop')||0, 10) - parseInt(self.currentItem.css('paddingBottom')||0, 10)); };
 * if(!p.width() || (jQuery.browser.msie && jQuery.browser.version.match('^7|^6'))) { p.width(self.currentItem.innerWidth() - parseInt(self.currentItem.css('paddingLeft')||0, 10) - parseInt(self.currentItem.css('paddingRight')||0, 10)); };
 */

/* TODO: support colgroups */

(function($) {
  $.fn.dragtable = function(options) {
    var defaults = {
      revert:true,                 // smooth revert
      dragHandle:'.table-handle',  // handle for moving cols, if not exists the whole 'th' is the handle
      maxMovingRows:40,            // 1 -> only header. 40 row should be enough, the rest is usually not in the viewport
      onlyHeaderThreshold:100,     // TODO: not implemented yet, switch automatically between entire col moving / only header moving
      dragaccept:null,             // draggable cols -> default all
      persistState:null,           // url or function -> plug in your custom persistState function right here. function call is persistState(originalTable)
      restoreState:null,           // JSON-Object or function: some kind of experimental aka Quick-Hack TODO: do it better
      beforeStart:$.noop,
      beforeMoving:$.noop,
      beforeReorganize:$.noop,
      beforeStop:$.noop
    };
    var opts = $.extend(defaults, options);

    // here comes the logic. Why var-name _D? My laziness is the culprit!
    var _D = {
      // this is the underlying -original- table
      originalTable:{
        el:$(),
        selectedHandle:$(),
        sortOrder:{},
        startIndex:0,
        endIndex:0
      },
      // this the sortable table on the layer above the original table
      sortableTable:{
        el:$(),
        selectedHandle:$(),
        movingRow:$()
      },
      swapNodes: function(a, b) {
        var aparent= a.parentNode;
        var asibling= a.nextSibling===b? a : a.nextSibling;
        b.parentNode.insertBefore(a, b);
        aparent.insertBefore(b, asibling);
      },
      // send ids=index as req-param to server
      persistState: function() {
          _D.originalTable.el.find('th').each(function(i) {
          if(this.id != '') {_D.originalTable.sortOrder[this.id]=i;}
        });
        $.ajax({url: opts.persistState,
                data: _D.originalTable.sortOrder});
      },
      /*
       * persistObj looks like 
       * {'id1','2','id3':'3','id2':'1'}
       * table looks like
       * |   id2  |   id1   |   id3   |                        
       */
      restoreState: function(persistObj) {;
          for(n in persistObj) {
            _D.originalTable.startIndex = $('#'+n).closest('th').prevAll().size() + 1;
            _D.originalTable.endIndex = parseInt(persistObj[n] + 1);
            _D.bubbleCols();
          }
      },
      // bubble the moved col left or right
      bubbleCols: function() {
        var from = _D.originalTable.startIndex;
        var to = _D.originalTable.endIndex;
        if(from < to) {
          for(var i = from; i < to; i++) {
            var row1 = _D.originalTable.el.find('tr > td:nth-child('+i+')')
                                          .add(_D.originalTable.el.find('tr > th:nth-child('+i+')'));
            var row2 = _D.originalTable.el.find('tr > td:nth-child('+(i+1)+')')
                                          .add(_D.originalTable.el.find('tr > th:nth-child('+(i+1)+')'));
            for(var j = 0; j < row1.length; j++) {
              _D.swapNodes(row1[j],row2[j]);
            }
          }
        }
        else {
          for(var i = from; i > to; i--) {
            var row1 = _D.originalTable.el.find('tr > td:nth-child('+i+')')
                                          .add(_D.originalTable.el.find('tr > th:nth-child('+i+')'));
            var row2 = _D.originalTable.el.find('tr > td:nth-child('+(i-1)+')')
                                          .add(_D.originalTable.el.find('tr > th:nth-child('+(i-1)+')'));
            for(var j = 0; j < row1.length; j++) {
              _D.swapNodes(row1[j],row2[j]);
            }
          }
        }
      },
      rearrangeTableBackroundProcessing: function() {
        return function() {
          _D.bubbleCols();
          opts.beforeStop(_D.originalTable);
          _D.sortableTable.el.remove();
          // persist state if necessary
          if(opts.persistState !== null) { 
            $.isFunction(opts.persistState) ? opts.persistState(_D.originalTable) : _D.persistState();
          }
        };
      },
      rearrangeTable: function() {
        // remove handler-class -> handler is now finished
        _D.originalTable.selectedHandle.removeClass('dragtable-handle-selected');
        // add disabled class -> reorgorganisation starts soon
        _D.sortableTable.el.sortable("disable");
        _D.sortableTable.el.addClass('dragtable-disabled');
        opts.beforeReorganize(_D.originalTable,_D.sortableTable);
        // do reorganisation asynchronous
        // for chrome a little bit more than 1 ms because we want to force a rerender
        _D.originalTable.endIndex = _D.sortableTable.movingRow.prevAll().size() + 1;
        setTimeout(_D.rearrangeTableBackroundProcessing(),50);
      },
      /*
       * Disrupts the table. The original table stays the same.
       * But on a layer above the original table we are constructing a list (ul > li)
       * each li with a separate table representig a single col of the original table.
       */
      generateSortable:function(e) {
        // table attributes 
        var attrs = _D.originalTable.el[0].attributes;
        var attrsString = '';
        for(var i=0; i < attrs.length;i++) {
            attrsString += attrs[i].nodeName + '="' + attrs[i].nodeValue+'"';
        }

        // row attributes
        var rowAttrsArr = [];
        //compute height, special handling for ie needed :-(
        var heightArr = [];
        _D.originalTable.el.find('tr').slice(0,opts.maxMovingRows).each(function(i,v) {
          // row attributes
          var attrs = this.attributes;
          var attrsString = "";
          for(var j=0; j < attrs.length;j++) {
            attrsString += " " + attrs[j].nodeName + '="' + attrs[j].nodeValue+'"';
            rowAttrsArr.push(attrsString);
          }
          /* the not so easy way */
          if(jQuery.browser.msie && jQuery.browser.version.match('^7|^6')) {
            _D.originalTable.el.find('tr').slice(0,opts.maxMovingRows).each(function(i,v) {
              var maxCellHeight = null;
              $(this).children().each(function() {
                var tmp = $(this).height();
                if(maxCellHeight == null || tmp > maxCellHeight) {maxCellHeight = tmp;}
              });
              heightArr.push(maxCellHeight);
            });
          }
          /* the easy way, but does not work very good in IE < 8 */
          else {
            _D.originalTable.el.find('tr').slice(0,opts.maxMovingRows).each(function(i,v) {
              heightArr.push($(this).height());
            });
          }
        });

        // compute width, no special handling for ie needed :-)
        var widthArr = [];
        // compute total width, needed for not wrapping around after the screen ends (floating)
        var totalWidth=0;
        _D.originalTable.el.find('tr > th').each(function(i,v) {
          // one extra px on right and left side
          totalWidth+=$(this).outerWidth()+2;
          widthArr.push($(this).width());
        });

        var sortableHtml = '<ul class="dragtable-sortable" style="position:absolute; width:'+totalWidth+'px;">';
        // assemble the needed html
        _D.originalTable.el.find('tr > th').each(function(i,v) {
          sortableHtml += '<li>';
          sortableHtml += '<table ' +  attrsString  + '>';
          var row = _D.originalTable.el.find('tr > th:nth-child('+(i+1)+')');
          if(opts.maxMovingRows > 1) {
            row = row.add(_D.originalTable.el.find('tr > td:nth-child('+(i+1)+')').slice(0,opts.maxMovingRows-1));
          }
          row.each(function(j) {
            /* the not so easy way (part 2)*/
            if(jQuery.browser.msie && jQuery.browser.version.match('^7|^6')) {
              sortableHtml += '<tr '+ rowAttrsArr[j] + '">';
              // TODO: May cause duplicate style-Attribute
              sortableHtml += $(this).clone().wrap('<div></div>').parent().html().replace('<TD','<TD style="height:'+heightArr[j]+'px;"');
            }
          /* the easy way, but does not work very good in IE < 8  (part 2) */
            else {
              // TODO: May cause duplicate style-Attribute
              sortableHtml += '<tr ' + rowAttrsArr[j] + '" style="height:'+heightArr[j]+'px;">';
              sortableHtml += $(this).clone().wrap('<div></div>').parent().html();
            }
            sortableHtml += '</tr>';
          });
          sortableHtml += '</table>';
          sortableHtml += '</li>';
        });
        sortableHtml += '</ul>';
        _D.sortableTable.el = _D.originalTable.el.before(sortableHtml).prev();1
        // set width if necessary
        _D.sortableTable.el.find('th').each(function(i,v) {
           var _this = $(this);
           if(widthArr[i] > _this.width()) {
             _this.css({'width':widthArr[i]});
           }
        });

        // assign _D.sortableTable.selectedHandle
        _D.sortableTable.selectedHandle = _D.sortableTable.el.find('th')
                                                          .find('.dragtable-handle-selected');

        var items = !opts.dragaccept ? 'li' : 'li:has(' + opts.dragaccept + ')';
        _D.sortableTable.el.sortable({stop:_D.rearrangeTable,
                                      items:items,
                                      revert:opts.revert,
                                      distance: 0
                                     })
                           .disableSelection();

        // assign start index
        _D.originalTable.startIndex = $(e.target).closest('th').prevAll().size() + 1;

        opts.beforeMoving(_D.originalTable, _D.sortableTable);
        // Start moving by delegating the original event to the new sortable table
        _D.sortableTable.movingRow = _D.sortableTable.el.find('li:nth-child('+_D.originalTable.startIndex+')');
        // TODO: learn more about events. Is this the right way?
        if($.support.noCloneEvent) {
          // clone
          var delegateEvt = $.extend(true, {}, e);
          _D.sortableTable.movingRow.trigger(delegateEvt);
          // clone
          var moveEvt = $.extend(true, {}, e);
          moveEvt = $.extend(true, moveEvt, {type:'mousemove',pageX:e.pageX+5,pageY:e.pageY+5});
          _D.sortableTable.movingRow.trigger(moveEvt);
        }
        // only IE
        else {
          _D.sortableTable.movingRow.trigger(e);
        }
      },
      /* Start asynchronously to be able to give the user a feedback on mousedown (rerender the dom)
       * Currently disabled. Is it a bug in jQuery?
       * TODO: Bugreport jQuery -> data.events not undefined-save line 4519, when using delayed events
       * It issues only warnings in IE, but that offends me anyway.
       */
      delayedStart:function(evt) {
        return function() {
          _D.generateSortable(evt);
        };
      }
    };

    return this.each(function(){
      _D.originalTable.el = $(this);
      // bind draggable to 'th' by default
      var bindTo = _D.originalTable.el.find('th');
      // filter only the cols that are accepted
      if(opts.dragaccept) { bindTo = bindTo.filter(opts.dragaccept); }
      // bind draggable to handle if exists
      if(bindTo.find(opts.dragHandle).size() > 0) { bindTo = bindTo.find(opts.dragHandle);}
      // restore state if necessary
      if(opts.restoreState !== null) { 
        $.isFunction(opts.restoreState) ? opts.restoreState(_D.originalTable) : _D.restoreState(opts.restoreState);
      }
      bindTo.bind('mousedown',function(evt) {
        _D.originalTable.selectedHandle = $(this);
        _D.originalTable.selectedHandle.addClass('dragtable-handle-selected');
        opts.beforeStart(_D.originalTable);
        // take a breath and rerender before creating sortable table
        // setTimeout(_D.delayedStart(evt),10);
        // for immediate start (no delay)
        _D.generateSortable(evt);
      });
    });
  };
})(jQuery);