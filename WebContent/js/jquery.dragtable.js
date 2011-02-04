/*!
 * dragtable
 *
 * @Version 2.0.0
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

/* TODO: support colgroups
 */
 
(function($) {
  $.widget("akottr.dragtable", {
    options: { 
       revert:true                  // smooth revert
      ,dragHandle:'.table-handle'  // handle for moving cols, if not exists the whole 'th' is the handle
      ,maxMovingRows:40            // 1 -> only header. 40 row should be enough, the rest is usually not in the viewport
      ,onlyHeaderThreshold:100     // TODO: not implemented yet, switch automatically between entire col moving / only header moving
      ,dragaccept:null             // draggable cols -> default all
      ,persistState:null           // url or function -> plug in your custom persistState function right here. function call is persistState(originalTable)
      ,restoreState:null           // JSON-Object or function: some kind of experimental aka Quick-Hack TODO: do it better
      ,beforeStart:$.noop
      ,beforeMoving:$.noop
      ,beforeReorganize:$.noop
      ,beforeStop:$.noop 
    },
    originalTable:{
       el:null
      ,selectedHandle:null
      ,sortOrder:null
      ,startIndex:0
      ,endIndex:0
    },
    sortableTable:{
       el:$()
      ,selectedHandle:$()
      ,movingRow:$()
    },
    _swapNodes: function(a, b) {
      var aparent= a.parentNode;
      var asibling= a.nextSibling===b? a : a.nextSibling;
      b.parentNode.insertBefore(a, b);
      aparent.insertBefore(b, asibling);
    },
    persistState: function() {
      var _this = this;
      this.originalTable.el.find('th').each(function(i) {
          if(this.id != '') {_this.originalTable.sortOrder[this.id]=i;}
        });
        $.ajax({url: this.options.persistState,
                data: this.originalTable.sortOrder});
    },
    /*
     * persistObj looks like 
     * {'id1':'2','id3':'3','id2':'1'}
     * table looks like
     * |   id2  |   id1   |   id3   |                        
     */
    _restoreState: function(persistObj) {;
      for(n in persistObj) {
        this.originalTable.startIndex = $('#'+n).closest('th').prevAll().size() + 1;
        this.originalTable.endIndex = parseInt(persistObj[n] + 1);
        this._bubbleCols();
      }
    },
    // bubble the moved col left or right
    _bubbleCols: function() {
      var from = this.originalTable.startIndex;
      var to = this.originalTable.endIndex;
      if(from < to) {
        for(var i = from; i < to; i++) {
          var row1 = this.originalTable.el.find('tr > td:nth-child('+i+')')
                                          .add(this.originalTable.el.find('tr > th:nth-child('+i+')'));
          var row2 = this.originalTable.el.find('tr > td:nth-child('+(i+1)+')')
                                          .add(this.originalTable.el.find('tr > th:nth-child('+(i+1)+')'));
          for(var j = 0; j < row1.length; j++) {
            this._swapNodes(row1[j],row2[j]);
          }
        }
      }
      else {
        for(var i = from; i > to; i--) {
          var row1 = this.originalTable.el.find('tr > td:nth-child('+i+')')
                                          .add(this.originalTable.el.find('tr > th:nth-child('+i+')'));
          var row2 = this.originalTable.el.find('tr > td:nth-child('+(i-1)+')')
                                          .add(this.originalTable.el.find('tr > th:nth-child('+(i-1)+')'));
          for(var j = 0; j < row1.length; j++) {
            this._swapNodes(row1[j],row2[j]);
          }
        }
      }
    },
    _rearrangeTableBackroundProcessing: function() {
      var _this = this;
      return function() {
        _this._bubbleCols();
        _this.options.beforeStop(this.originalTable);
        _this.sortableTable.el.remove();
        // persist state if necessary
        if(_this.options.persistState !== null) { 
          $.isFunction(_this.options.persistState) ? _this.options.persistState(_this.originalTable) : _this.persistState();
        }
      };
    },
    _rearrangeTable: function() {
      var _this = this;
      return function() {
      // remove handler-class -> handler is now finished
      _this.originalTable.selectedHandle.removeClass('dragtable-handle-selected');
      // add disabled class -> reorgorganisation starts soon
      _this.sortableTable.el.sortable("disable");
      _this.sortableTable.el.addClass('dragtable-disabled');
      _this.options.beforeReorganize(_this.originalTable,_this.sortableTable);
      // do reorganisation asynchronous
      // for chrome a little bit more than 1 ms because we want to force a rerender
      _this.originalTable.endIndex = _this.sortableTable.movingRow.prevAll().size() + 1;
      setTimeout(_this._rearrangeTableBackroundProcessing(),50);      
      }
    },
    /*
     * Disrupts the table. The original table stays the same.
     * But on a layer above the original table we are constructing a list (ul > li)
     * each li with a separate table representig a single col of the original table.
     */
    _generateSortable:function(e) {
      var _this = this;
      // table attributes 
      var attrs = this.originalTable.el[0].attributes;
      var attrsString = '';
      for(var i=0; i < attrs.length;i++) {
        if(attrs[i].nodeValue) {
          attrsString += attrs[i].nodeName + '="' + attrs[i].nodeValue+'" ';
        }
      }

      // row attributes
      var rowAttrsArr = [];
      //compute height, special handling for ie needed :-(
      var heightArr = [];
      this.originalTable.el.find('tr').slice(0,this.options.maxMovingRows).each(function(i,v) {
        // row attributes
        var attrs = this.attributes;
        var attrsString = "";
        for(var j=0; j < attrs.length;j++) {
          if(attrs[j].nodeValue) {
            attrsString += " " + attrs[j].nodeName + '="' + attrs[j].nodeValue+'"';
          }
        }
        rowAttrsArr.push(attrsString);
        /* the not so easy way */
        if(jQuery.browser.msie && jQuery.browser.version.match('^7|^6')) {
          var maxCellHeight = null;
          $(this).children().each(function() {
            /* I think here is a bug. I have to take in account the padding-top and padding-bottom
             * TODO: substract $(this).height().css('padding-top') and $(this).height().css('padding-bottom');
             * deeper investiagtion needed
             */
            var tmp = $(this).height();    
            if(maxCellHeight == null || tmp > maxCellHeight) {maxCellHeight = tmp;}
          });
          heightArr.push(maxCellHeight);
        }
        /* the easy way, but does not work very good in IE < 8 */
        else {
          heightArr.push($(this).height()); 
        }
      });

      // compute width, no special handling for ie needed :-)
      var widthArr = [];
      // compute total width, needed for not wrapping around after the screen ends (floating)
      var totalWidth=0;
      this.originalTable.el.find('tr > th').each(function(i,v) {
        // one extra px on right and left side
        totalWidth+=$(this).outerWidth()+2;
        widthArr.push($(this).width());
      });

      var sortableHtml = '<ul class="dragtable-sortable" style="position:absolute; width:'+totalWidth+'px;">';
      // assemble the needed html
      this.originalTable.el.find('tr > th').each(function(i,v) {
        sortableHtml += '<li>';
        sortableHtml += '<table ' +  attrsString  + '>';
        var row = _this.originalTable.el.find('tr > th:nth-child('+(i+1)+')');
        if(_this.options.maxMovingRows > 1) {
          row = row.add(_this.originalTable.el.find('tr > td:nth-child('+(i+1)+')').slice(0,_this.options.maxMovingRows-1));
        }
        row.each(function(j) {
          /* the not so easy way (part 2)*/
          if(jQuery.browser.msie && jQuery.browser.version.match('^7|^6')) {
            sortableHtml += '<tr '+ rowAttrsArr[j] + '>';
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
      this.sortableTable.el = this.originalTable.el.before(sortableHtml).prev();1
      // set width if necessary
      this.sortableTable.el.find('th').each(function(i,v) {
        var _this = $(this);
         if(widthArr[i] != _this.width()) {
           _this.css({'width':widthArr[i]});
         }
      });

      // assign this.sortableTable.selectedHandle
      this.sortableTable.selectedHandle = this.sortableTable.el.find('th')
                                                               .find('.dragtable-handle-selected');

      var items = !this.options.dragaccept ? 'li' : 'li:has(' + this.options.dragaccept + ')';
      this.sortableTable.el.sortable({stop:this._rearrangeTable(),
                                      items:items,
                                      revert:this.options.revert,
                                      distance: 0
                                     })
                           .disableSelection();

      // assign start index
      this.originalTable.startIndex = $(e.target).closest('th').prevAll().size() + 1;

      this.options.beforeMoving(this.originalTable, this.sortableTable);
      // Start moving by delegating the original event to the new sortable table
      this.sortableTable.movingRow = this.sortableTable.el.find('li:nth-child('+this.originalTable.startIndex+')');
      // TODO: learn more about events. Is this the right way?
      if($.support.noCloneEvent) {
        // clone
        var delegateEvt = $.extend(true, {}, e);
        this.sortableTable.movingRow.trigger(delegateEvt);
        // clone
        var moveEvt = $.extend(true, {}, e);
        moveEvt = $.extend(true, moveEvt, {type:'mousemove',pageX:e.pageX+5,pageY:e.pageY+5});
        this.sortableTable.movingRow.trigger(moveEvt);
      }
      // only IE
      else {
        this.sortableTable.movingRow.trigger(e);
      }
      // Some inner divs to deliver the posibillity to style the placeholder more sophisticated
      this.sortableTable.el.find('.ui-sortable-placeholder').html('<div class="outer" style="height:100%;"><div class="inner" style="height:100%;"></div></div>');
    },
    /* Start asynchronously to be able to give the user a feedback on mousedown (rerender the dom)
     * Currently disabled. Is it a bug in jQuery?
     * TODO: Bugreport jQuery -> data.events not undefined-save line 4519, when using delayed events
     * It issues only warnings in IE, but that offends me anyway.
     */
    _delayedStart:function(evt) {
      return function() {
        this._generateSortable(evt);
      };
    },
    _create: function(){    
      this.originalTable = {
         el:this.element
        ,selectedHandle:$()
        ,sortOrder:{}
        ,startIndex:0
        ,endIndex:0
      };
      // bind draggable to 'th' by default
      var bindTo = this.originalTable.el.find('th');
      // filter only the cols that are accepted
      if(this.options.dragaccept) { bindTo = bindTo.filter(this.options.dragaccept); }
      // bind draggable to handle if exists
      if(bindTo.find(this.options.dragHandle).size() > 0) { bindTo = bindTo.find(this.options.dragHandle);}
      // restore state if necessary
      if(this.options.restoreState !== null) { 
        $.isFunction(this.options.restoreState) ? this.options.restoreState(this.originalTable) : this._restoreState(this.options.restoreState);
      }
      var _this = this;
      bindTo.bind('mousedown',function(evt) {
        _this.originalTable.selectedHandle = $(this);
        _this.originalTable.selectedHandle.addClass('dragtable-handle-selected');
        _this.options.beforeStart(this.originalTable);
        // take a breath and rerender before creating sortable table
        // setTimeout(this._delayedStart(evt),10);
        // for immediate start (no delay)
        _this._generateSortable(evt);
      });
    },
    destroy: function() {
        $.Widget.prototype.destroy.apply(this, arguments); // default destroy
         // now do other stuff particular to this widget
    }    
  });
})(jQuery);
