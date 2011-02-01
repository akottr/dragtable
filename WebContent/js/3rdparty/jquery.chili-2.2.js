/*
===============================================================================
Chili is the jQuery code highlighter plugin
...............................................................................
LICENSE: http://www.opensource.org/licenses/mit-license.php
WEBSITE: http://noteslog.com/chili/

											   Copyright 2008 / Andrea Ercolino
===============================================================================
*/


( function($) {

ChiliBook = { //implied global

	  version:            "2.2" // 2008-07-06

// options --------------------------------------------------------------------

	, automatic:          true
	, automaticSelector:  "code"

	, lineNumbers:        !true

	, codeLanguage:       function( el ) {
		var recipeName = $( el ).attr( "class" );
		return recipeName ? recipeName : '';
	}

	, recipeLoading:      true
	, recipeFolder:       "" // used like: recipeFolder + recipeName + '.js'

	// IE and FF convert &#160; to "&nbsp;", Safari and Opera do not
	, replaceSpace:       "&#160;"
	, replaceTab:         "&#160;&#160;&#160;&#160;"
	, replaceNewLine:     "&#160;<br/>"

//	, selectionStyle:     [ "position:absolute; z-index:3000; overflow:scroll;"
//						  , "width:16em;"
//						  , "height:9em;"
//						  , "border:1px solid gray;"
//						  , "padding:15px;"
//						  , "background-color:yellow;"
//						  ].join( ' ' )

// ------------------------------------------------------------- end of options

	, defaultReplacement: '<span class="$0">$$</span>' // TODO: make this an option again
	, recipes:            {} //repository
	, queue:              {} //registry

	, unique:             function() {
		return (new Date()).valueOf();
	}
};



$.fn.chili = function( options ) {
	var book = $.extend( {}, ChiliBook, options || {} );

	function cook( ingredients, recipe, blockName ) {

		function prepareBlock( recipe, blockName ) {
			var steps = [];
			for( var stepName in recipe[ blockName ] ) {
				steps.push( prepareStep( recipe, blockName, stepName ) );
			}
			return steps;
		} // prepareBlock

		function prepareStep( recipe, blockName, stepName ) {
			var step = recipe[ blockName ][ stepName ];
			var exp = ( typeof step._match == "string" ) ? step._match : step._match.source;
			return {
				recipe: recipe
				, blockName: blockName
				, stepName: stepName
				, exp: "(" + exp + ")"
				, length: 1                         // add 1 to account for the newly added parentheses
					+ (exp                          // count number of submatches in here
						.replace( /\\./g, "%" )     // disable any escaped character
						.replace( /\[.*?\]/g, "%" ) // disable any character class
						.match( /\((?!\?)/g )       // match any open parenthesis, not followed by a ?
					|| []                           // make sure it is an empty array if there are no matches
					).length                        // get the number of matches
				, replacement: step._replace ? step._replace : book.defaultReplacement
			};
		} // prepareStep
	
		function knowHow( steps ) {
			var prevLength = 1;
			var exps = [];
			for (var i = 0; i < steps.length; i++) {
				var exp = steps[ i ].exp;
				// adjust backreferences
				exp = exp.replace( /\\\\|\\(\d+)/g, function( m, aNum ) {
					return !aNum ? m : "\\" + ( prevLength + 1 + parseInt( aNum, 10 ) );
				} );
				exps.push( exp );
				prevLength += steps[ i ].length;
			}
			var prolog = '((?:\\s|\\S)*?)';
			var epilog = '((?:\\s|\\S)+)';
			var source = '(?:' + exps.join( "|" ) + ')';
			source = prolog + source + '|' + epilog;
			return new RegExp( source, recipe._case ? "g" : "gi" );
		} // knowHow

		function escapeHTML( str ) {
			return str.replace( /&/g, "&amp;" ).replace( /</g, "&lt;" );
		} // escapeHTML

		function replaceSpaces( str ) {
			return str.replace( / +/g, function( spaces ) {
				return spaces.replace( / /g, replaceSpace );
			} );
		} // replaceSpaces

		function filter( str ) {
			str = escapeHTML( str );
			if( replaceSpace ) {
				str = replaceSpaces( str );
			}
			return str;
		} // filter

		function applyRecipe( subject, recipe ) {
			return cook( subject, recipe );
		} // applyRecipe

		function applyBlock( subject, recipe, blockName ) {
			return cook( subject, recipe, blockName );
		} // applyBlock

		function applyStep( subject, recipe, blockName, stepName ) {
			var replaceSpace       = book.replaceSpace;

			var step = prepareStep( recipe, blockName, stepName );
			var steps = [step];

			var perfect = subject.replace( knowHow( steps ), function() {
				return chef.apply( { steps: steps }, arguments );
			} );
			return perfect;
		} // applyStep

		function applyModule( subject, module, context ) {
			if( ! module ) {
				return filter( subject );
			}

			var sub = module.split( '/' );
			var recipeName = '';
			var blockName  = '';
			var stepName   = '';
			switch( sub.length ) {
				case 1:
					recipeName = sub[0];
					break;
				case 2:
					recipeName = sub[0]; blockName = sub[1];
					break;
				case 3:
					recipeName = sub[0]; blockName = sub[1]; stepName = sub[2];
					break;
				default:
					return filter( subject );
			}

			function getRecipe( recipeName ) {
				var path = getPath( recipeName );
				var recipe = book.recipes[ path ];
				if( ! recipe ) {
					throw {msg:"recipe not available"};
				}
				return recipe;
			}

			try {
				var recipe;
				if ( '' == stepName ) {
					if ( '' == blockName ) {
						if ( '' == recipeName ) {
							//nothing to do
						}
						else { // ( '' != recipeName )
							recipe = getRecipe( recipeName );
							return applyRecipe( subject, recipe );
						}
					}
					else { // ( '' != blockName )
						if( '' == recipeName ) {
							recipe = context.recipe;
						}
						else {
							recipe = getRecipe( recipeName );
						}
						if( ! (blockName in recipe) ) {
							return filter( subject );
						}
						return applyBlock( subject, recipe, blockName );
					}
				}
				else { // ( '' != stepName )
					if( '' == recipeName ) {
						recipe = context.recipe;
					}
					else {
						recipe = getRecipe( recipeName );
					}
					if( '' == blockName ) {
						blockName = context.blockName;
					}
					if( ! (blockName in recipe) ) {
						return filter( subject );
					}
					if( ! (stepName in recipe[blockName]) ) {
						return filter( subject );
					}
					return applyStep( subject, recipe, blockName, stepName );
				}
			}
			catch( e ) {
				if (e.msg && e.msg == "recipe not available") {
					var cue = 'chili_' + book.unique();
					if( book.recipeLoading ) {
						var path = getPath( recipeName );
						if( ! book.queue[ path ] ) {
							/* this is a new recipe to download */
							try {
								book.queue[ path ] = [ {cue: cue, subject: subject, module: module, context: context} ];
								$.getJSON( path, function( recipeLoaded ) {
									book.recipes[ path ] = recipeLoaded;
									var q = book.queue[ path ];
									for( var i = 0, iTop = q.length; i < iTop; i++ ) {
										var replacement = applyModule( q[ i ].subject, q[ i ].module, q[ i ].context );
										if( book.replaceTab ) {
											replacement = replacement.replace( /\t/g, book.replaceTab );
										}
										if( book.replaceNewLine ) {
											replacement = replacement.replace( /\n/g, book.replaceNewLine );
										}
										$( '#' + q[ i ].cue ).replaceWith( replacement );
									}
								} );
							}
							catch( recipeNotAvailable ) {
								alert( "the recipe for '" + recipeName + "' was not found in '" + path + "'" );
							}
						}
						else {
							/* not a new recipe, so just enqueue this element */
							book.queue[ path ].push( {cue: cue, subject: subject, module: module, context: context} );
						}
						return '<span id="' + cue + '">' + filter( subject ) + '</span>';
					}
					return filter( subject );
				}
				else {
					return filter( subject );
				}
			}
		} // applyModule

		function addPrefix( prefix, replacement ) {
			var aux = replacement.replace( /(<span\s+class\s*=\s*(["']))((?:(?!__)\w)+\2\s*>)/ig, "$1" + prefix + "__$3" );
			return aux;
		} // addPrefix

		function chef() {
			if (! arguments[ 0 ]) {
				return '';
			}
			var steps = this.steps;
			var i = 0;  // iterate steps
			var j = 2;	// iterate chef's arguments
			var prolog = arguments[ 1 ];
			var epilog = arguments[ arguments.length - 3 ];
			if (! epilog) {
				var step;
				while( step = steps[ i++ ] ) {
					var aux = arguments; // this unmasks chef's arguments inside the next function
					if( aux[ j ] ) {
						var replacement = '';
						if( $.isFunction( step.replacement ) ) {
							var matches = []; //Array.slice.call( aux, j, step.length );
							for (var k = 0, kTop = step.length; k < kTop; k++) {
								matches.push( aux[ j + k ] );
							}
							matches.push( aux[ aux.length - 2 ] );
							matches.push( aux[ aux.length - 1 ] );
							replacement = step.replacement
								.apply( { 
									x: function() { 
										var subject = arguments[0];
										var module  = arguments[1];
										var context = { 
											  recipe:    step.recipe
											, blockName: step.blockName 
										};
										return applyModule( subject, module, context );
									} 
								}, matches );
						}
						else { //we expect step.replacement to be a string
							replacement = step.replacement
								.replace( /(\\\$)|(?:\$\$)|(?:\$(\d+))/g, function( m, escaped, K ) {
									if( escaped ) {       /* \$ */ 
										return "$";
									}
									else if( !K ) {       /* $$ */ 
										return filter( aux[ j ] );
									}
									else if( K == "0" ) { /* $0 */ 
										return step.stepName;
									}
									else {                /* $K */
										return filter( aux[ j + parseInt( K, 10 ) ] );
									}
								} );
						}
						replacement = addPrefix( step.recipe._name, replacement );
						return filter( prolog ) + replacement;
					} 
					else {
						j+= step.length;
					}
				}
			}
			else {
				return filter( epilog );
			}
		} // chef

		if( ! blockName ) {
			blockName = '_main';
			checkSpices( recipe );
		}
		if( ! (blockName in recipe) ) {
			return filter( ingredients );
		}
		var replaceSpace = book.replaceSpace;
		var steps = prepareBlock( recipe, blockName );
		var kh = knowHow( steps );
		var perfect = ingredients.replace( kh, function() {
			return chef.apply( { steps: steps }, arguments );
		} );
		return perfect;

	} // cook

	function loadStylesheetInline( sourceCode ) { 
		if( document.createElement ) { 
			var e = document.createElement( "style" ); 
			e.type = "text/css"; 
			if( e.styleSheet ) { // IE 
				e.styleSheet.cssText = sourceCode; 
			}  
			else { 
				var t = document.createTextNode( sourceCode ); 
				e.appendChild( t ); 
			} 
			document.getElementsByTagName( "head" )[0].appendChild( e ); 
		} 
	} // loadStylesheetInline
			
	function checkSpices( recipe ) {
		var name = recipe._name;
		if( ! book.queue[ name ] ) {

			var content = ['/* Chili -- ' + name + ' */'];
			for (var blockName in recipe) {
				if( blockName.search( /^_(?!main\b)/ ) < 0 ) {
					for (var stepName in recipe[ blockName ]) {
						var step = recipe[ blockName ][ stepName ];
						if( '_style' in step ) {
							if( step[ '_style' ].constructor == String ) {
								content.push( '.' + name + '__' + stepName + ' { ' + step[ '_style' ] + ' }' );
							}
							else {
								for (var className in step[ '_style' ]) {
									content.push( '.' + name + '__' + className + ' { ' + step[ '_style' ][ className ] + ' }' );
								}
							}
						}
					}
				}
			}
			content = content.join('\n');

			loadStylesheetInline( content );

			book.queue[ name ] = true;
		}
	} // checkSpices

	function askDish( el ) {
		var recipeName = book.codeLanguage( el );
		if( '' != recipeName ) {
			var path = getPath( recipeName );
			if( book.recipeLoading ) {
				/* dynamic setups come here */
				if( ! book.queue[ path ] ) {
					/* this is a new recipe to download */
					try {
						book.queue[ path ] = [ el ];
						$.getJSON( path, function( recipeLoaded ) {
							book.recipes[ path ] = recipeLoaded;
							var q = book.queue[ path ];
							for( var i = 0, iTop = q.length; i < iTop; i++ ) {
								makeDish( q[ i ], path );
							}
						} );
					}
					catch( recipeNotAvailable ) {
						alert( "the recipe for '" + recipeName + "' was not found in '" + path + "'" );
					}
				}
				else {
					/* not a new recipe, so just enqueue this element */
					book.queue[ path ].push( el );
				}
				/* a recipe could have been already downloaded */
				makeDish( el, path ); 
			}
			else {
				/* static setups come here */
				makeDish( el, path );
			}
		}
	} // askDish

	function makeDish( el, recipePath ) {
		var recipe = book.recipes[ recipePath ];
		if( ! recipe ) {
			return;
		}
		var $el = $( el );
		var ingredients = $el.text();
		if( ! ingredients ) {
			return;
		}

		//fix for msie: \r (13) is used instead of \n (10)
		//fix for opera: \r\n is used instead of \n
		ingredients = ingredients.replace(/\r\n?/g, "\n");

		//reverse fix for safari: msie, mozilla and opera render the initial \n
		if( $el.parent().is('pre') ) {
			if( ! $.browser.safari ) {
				ingredients = ingredients.replace(/^\n/g, "");
			}
		}

		var dish = cook( ingredients, recipe ); // all happens here
	
		if( book.replaceTab ) {
			dish = dish.replace( /\t/g, book.replaceTab );
		}
		if( book.replaceNewLine ) {
			dish = dish.replace( /\n/g, book.replaceNewLine );
		}

		el.innerHTML = dish; //much faster than $el.html( dish );
		//tried also the function replaceHtml from http://blog.stevenlevithan.com/archives/faster-than-innerhtml
		//but it was not faster nor without sideffects (it was not possible to count spans into el)

		//opera and safari select PRE text correctly 
		if( $.browser.msie || $.browser.mozilla ) {
			enableSelectionHelper( el );
		}

		var $that = $el.parent();
		var classes = $that.attr( 'class' );
		var ln = /ln-(\d+)-([\w][\w\-]*)|ln-(\d+)|ln-/.exec( classes );
		if( ln ) {
			addLineNumbers( el );
			var start = 0;
			if( ln[1] ) {
				start = parseInt( ln[1], 10 );
				var $pieces = $( '.ln-' + ln[1] + '-' + ln[2] );
				var pos = $pieces.index( $that[0] );
				$pieces.slice( 0, pos ).each( function() {
					start += $( this ).find( 'li' ).length;
				} );
			}
			else if( ln[3] ) {
				start = parseInt( ln[3], 10 );
			}
			else {
				start = 1;
			}
			$el.find( 'ol' )[0].start = start;
			$('body').width( $('body').width() - 1 ).width( $('body').width() + 1 );
		}
		else if( book.lineNumbers ) {
			addLineNumbers( el );
		}

	} // makeDish

	function enableSelectionHelper( el ) {
		return false;
		
		var element = null;
		$( el )
		.parents()
		.filter( "pre" )
		.bind( "mousedown", function() {
			element = this;
			if( $.browser.msie ) {
				document.selection.empty();
			}
			else {
				window.getSelection().removeAllRanges();
			}
		} )
		.bind( "mouseup", function( event ) {
			if( element && (element == this) ) {
				element = null;
				var selected = '';
				if( $.browser.msie ) {
					selected = document.selection.createRange().htmlText;
					if( '' == selected ) { 
						return;
					}
					selected = preserveNewLines( selected );
					var container_tag = '<textarea style="STYLE">';
				}
				else {
					selected = window.getSelection().toString(); //opera doesn't select new lines
					if( '' == selected ) {
						return;
					}
					selected = selected
						.replace( /\r/g, '' )
						.replace( /^# ?/g, '' )
						.replace( /\n# ?/g, '\n' )
					;
					var container_tag = '<pre style="STYLE">';
				}
				var $container = $( container_tag.replace( /\bSTYLE\b/, ChiliBook.selectionStyle ) )
					.appendTo( 'body' )
					.text( selected )
					.attr( 'id', 'chili_selection' )
					.click( function() { $(this).remove(); } )
				;
				var top  = event.pageY - Math.round( $container.height() / 2 ) + "px";
				var left = event.pageX - Math.round( $container.width() / 2 ) + "px";
				$container.css( { top: top, left: left } );
				if( $.browser.msie ) {
//					window.clipboardData.setData( 'Text', selected ); //I couldn't find anything similar for Mozilla
					$container[0].focus();
					$container[0].select();
				}
				else {
					var s = window.getSelection();
					s.removeAllRanges();
					var r = document.createRange();
					r.selectNodeContents( $container[0] );
					s.addRange( r );
				}
			}
		} )
		;
	} // enableSelectionHelper

	function getPath( recipeName ) {
		return book.recipeFolder + recipeName + ".js";
	} // getPath

	function getSelectedText() {
		var text = '';
		if( $.browser.msie ) {
			text = document.selection.createRange().htmlText;
		}
		else {
			text = window.getSelection().toString();
		}
		return text;
	} // getSelectedText

	function preserveNewLines( html ) {
		do { 
			var newline_flag = ChiliBook.unique();
		}
		while( html.indexOf( newline_flag ) > -1 );
		var text = '';
		if (/<br/i.test(html) || /<li/i.test(html)) {
			if (/<br/i.test(html)) {
				html = html.replace( /\<br[^>]*?\>/ig, newline_flag );
			}
			else if (/<li/i.test(html)) {
				html = html.replace( /<ol[^>]*?>|<\/ol>|<li[^>]*?>/ig, '' ).replace( /<\/li>/ig, newline_flag );
			}
			var el = $( '<pre>' ).appendTo( 'body' ).hide()[0];
			el.innerHTML = html;
			text = $( el ).text().replace( new RegExp( newline_flag, "g" ), '\r\n' );
			$( el ).remove();
		}
		return text;
	} // preserveNewLines

	function addLineNumbers( el ) {

		function makeListItem1( not_last_line, not_last, last, open ) {
			var close = open ? '</span>' : '';
			var aux = '';
			if( not_last_line ) {
				aux = '<li>' + open + not_last + close + '</li>';
			}
			else if( last ) {
				aux = '<li>' + open + last + close + '</li>';
			}
			return aux;
		} // makeListItem1

		function makeListItem2( not_last_line, not_last, last, prev_li ) {
			var aux = '';
			if( prev_li ) {
				aux = prev_li;
			}
			else {
				aux = makeListItem1( not_last_line, not_last, last, '' )
			}
			return aux;
		} // makeListItem2

		var html = $( el ).html();
		var br = /<br>/.test(html) ? '<br>' : '<BR>';
		var empty_line = '<li>' + book.replaceSpace + '</li>';
		var list_items = html
			//extract newlines at the beginning of a span
			.replace( /(<span [^>]+>)((?:(?:&nbsp;|\xA0)<br>)+)(.*?)(<\/span>)/ig, '$2$1$3$4' ) // I don't know why <span .*?> does not work here
			//transform newlines inside of a span
			.replace( /(.*?)(<span .*?>)(.*?)(?:<\/span>(?:&nbsp;|\xA0)<br>|<\/span>)/ig,       // but here it does
				function( all, before, open, content ) {
					if (/<br>/i.test(content)) {
						var pieces = before.split( br );
						var lastPiece = pieces.pop();
						before = pieces.join( br );
						var aux = (before ? before + br : '') //+ replace1( lastPiece + content, open );
							+ (lastPiece + content).replace( /((.*?)(?:&nbsp;|\xA0)<br>)|(.*)/ig, 
							function( tmp, not_last_line, not_last, last ) {
								var aux2 = makeListItem1( not_last_line, not_last, last, open );
								return aux2;
							} 
						);
						return aux;
					}
					else {
						return all;
					}
				} 
			)
			//transform newlines outside of a span
			.replace( /(<li>.*?<\/li>)|((.*?)(?:&nbsp;|\xA0)<br>)|(.+)/ig, 
				function( tmp, prev_li, not_last_line, not_last, last ) {
					var aux2 = makeListItem2( not_last_line, not_last, last, prev_li );
					return aux2;
				} 
			)
			//fix empty lines for Opera
			.replace( /<li><\/li>/ig, empty_line )
		;

		el.innerHTML = '<ol>' + list_items + '</ol>';
	} // addLineNumbers

	function revealChars( tmp ) {
		return $
			.map( tmp.split(''), 
				function(n, i) { 
					return ' ' + n + ' ' + n.charCodeAt( 0 ) + ' ';
				} )
			.join(' ');
	} // revealChars

//-----------------------------------------------------------------------------
// the coloring starts here
	this
	.each( function() {
		var $this = $( this );
		$this.trigger( 'chili.before_coloring' );
		askDish( this );
		$this.trigger( 'chili.after_coloring' );
	} );

	return this;
//-----------------------------------------------------------------------------
};



//main
$( function() {

	if( ChiliBook.automatic ) {
		$( ChiliBook.automaticSelector ).chili();
	}

} );

} ) ( jQuery );

/*
===============================================================================
Chili is the jQuery code highlighter plugin
...............................................................................
LICENSE: http://www.opensource.org/licenses/mit-license.php
WEBSITE: http://noteslog.com/chili/

											   Copyright 2008 / Andrea Ercolino
===============================================================================
*/

ChiliBook.recipeLoading = false;



ChiliBook.recipes[ "php.js" ] =
/* ----------------------------------------------------------------------------
 * this recipe uses a little trick for highlighting php code
 *   1: replace each php snippet with a placeholder
 *   2: highlight html without php and php snippets apart
 *   3: replace each placeholder with its highlighted php snippet
 * 
 * the trick is not perfect only if the html without php is broken
 * however, in such a case many highlighters get fooled but Chili does not
 * 
 * ---
 * this recipe has been adapted for working with Safari
 * in fact, Safari cannot match more than 101236 characters with a lazy star
 * --------------------------------------------------------------------------*/
{
	  _name: "php"
	, _case: true
	, _main: {
		  all: {
			  _match: /[\w\W]*/ 
			, _replace: function( all ) {
				var placeholder = String.fromCharCode(0);
				var blocks = [];
				var that = this;
				var no_php_1 = all.replace( /<\?[^?]*\?+(?:[^>][^?]*\?+)*>/g, function( block ) {
					blocks.push( that.x( block, '/block/php_1' ) );
					return placeholder;
				} );
				var no_php_2 = no_php_1.replace( /^[^?]*\?+(?:[^>][^?]*\?+)*>|<\?[\w\W]*$/g, function( block ) {
					blocks.push( that.x( block, '/block/php_2' ) );
					return placeholder;
				} );
				if( blocks.length ) {
					var html = this.x( no_php_2, 'html' );
					var count = 0;
					return html.replace( new RegExp( placeholder, "g" ), function() {
						return blocks[ count++ ];
					} );
				}
				else {
					return this.x( all, '/php' );
				}
			}
		}
	}
	, block: {
		  php_1: { // --- <? +++ ?> ---
			  _match: /(<\?(?:php\b)?)([^?]*\?+(?:[^>][^?]*\?+)*>)/
			, _replace: function( all, open, content ) {
				return "<span class='start'>" + this.x( open ) + "</span>"
					+ this.x( content.replace( /\?>$/, '' ), '/php' ) 
					+ "<span class='end'>" + this.x( '?>' ) + "</span>";
			}
			, _style: {
					  start: "color: red; font-weight: bold"
					, end:   "color: red;"
			}
		}
		, php_2: { // +++ ?> --- <? +++
			  _match: /([^?]*\?+(?:[^>][^?]*\?+)*>)|(<\?(?:php\b)?)([\w\W]*)/
			, _replace: function( all, content, open2, content2 ) {
				if( open2 ) {
					return "<span class='start'>" + this.x( open2 ) + "</span>"
						+ this.x( content2, '/php' );
				}
				else {
					return this.x( content.replace( /\?>$/, '' ), '/php' ) 
						+ "<span class='end'>" + this.x( '?>' ) + "</span>";
				}
			}
			, _style: {
					  start: "color: red; font-weight: bold"
					, end:   "color: red;"
			}
		}
	}
	, php: {
		  mlcom: {
			  _match: /\/\*[^*]*\*+([^\/][^*]*\*+)*\// 
			, _style: "color: gray;"
		}
		, com: {
			  _match: /(?:\/\/.*)|(?:[^\\]\#.*)/ 
			, _style: "color: green;"
		}
		, string1: {
			  _match: /\'[^\'\\]*(?:\\.[^\'\\]*)*\'/ 
			, _style: "color: purple;"
		}
		, string2: {
			  _match: /\"[^\"\\]*(?:\\.[^\"\\]*)*\"/ 
			, _style: "color: fuchsia;"
		}
		, value: {
			  _match: /\b(?:[Nn][Uu][Ll][Ll]|[Tt][Rr][Uu][Ee]|[Ff][Aa][Ll][Ss][Ee])\b/ 
			, _style: "color: gray; font-weight: bold;"
		}
		, number: {
			  _match: /\b[+-]?(\d*\.?\d+|\d+\.?\d*)([eE][+-]?\d+)?\b/ 
			, _style: "color: red;"
		}
		, const1: {
			  _match: /\b(?:DEFAULT_INCLUDE_PATH|E_(?:ALL|CO(?:MPILE_(?:ERROR|WARNING)|RE_(?:ERROR|WARNING))|ERROR|NOTICE|PARSE|STRICT|USER_(?:ERROR|NOTICE|WARNING)|WARNING)|P(?:EAR_(?:EXTENSION_DIR|INSTALL_DIR)|HP_(?:BINDIR|CONFIG_FILE_(?:PATH|SCAN_DIR)|DATADIR|E(?:OL|XTENSION_DIR)|INT_(?:MAX|SIZE)|L(?:IBDIR|OCALSTATEDIR)|O(?:S|UTPUT_HANDLER_(?:CONT|END|START))|PREFIX|S(?:API|HLIB_SUFFIX|YSCONFDIR)|VERSION))|__COMPILER_HALT_OFFSET__)\b/ 
			, _style: "color: red;"
		}
		, const2: {
			  _match: /\b(?:A(?:B(?:DAY_(?:1|2|3|4|5|6|7)|MON_(?:1(?:0|1|2|)|2|3|4|5|6|7|8|9))|LT_DIGITS|M_STR|SSERT_(?:ACTIVE|BAIL|CALLBACK|QUIET_EVAL|WARNING))|C(?:ASE_(?:LOWER|UPPER)|HAR_MAX|O(?:DESET|NNECTION_(?:ABORTED|NORMAL|TIMEOUT)|UNT_(?:NORMAL|RECURSIVE))|R(?:EDITS_(?:ALL|DOCS|FULLPAGE|G(?:ENERAL|ROUP)|MODULES|QA|SAPI)|NCYSTR|YPT_(?:BLOWFISH|EXT_DES|MD5|S(?:ALT_LENGTH|TD_DES)))|URRENCY_SYMBOL)|D(?:AY_(?:1|2|3|4|5|6|7)|ECIMAL_POINT|IRECTORY_SEPARATOR|_(?:FMT|T_FMT))|E(?:NT_(?:COMPAT|NOQUOTES|QUOTES)|RA(?:_(?:D_(?:FMT|T_FMT)|T_FMT|YEAR)|)|XTR_(?:IF_EXISTS|OVERWRITE|PREFIX_(?:ALL|I(?:F_EXISTS|NVALID)|SAME)|SKIP))|FRAC_DIGITS|GROUPING|HTML_(?:ENTITIES|SPECIALCHARS)|IN(?:FO_(?:ALL|C(?:ONFIGURATION|REDITS)|ENVIRONMENT|GENERAL|LICENSE|MODULES|VARIABLES)|I_(?:ALL|PERDIR|SYSTEM|USER)|T_(?:CURR_SYMBOL|FRAC_DIGITS))|L(?:C_(?:ALL|C(?:OLLATE|TYPE)|M(?:ESSAGES|ONETARY)|NUMERIC|TIME)|O(?:CK_(?:EX|NB|SH|UN)|G_(?:A(?:LERT|UTH(?:PRIV|))|C(?:ONS|R(?:IT|ON))|D(?:AEMON|EBUG)|E(?:MERG|RR)|INFO|KERN|L(?:OCAL(?:0|1|2|3|4|5|6|7)|PR)|MAIL|N(?:DELAY|EWS|O(?:TICE|WAIT))|ODELAY|P(?:ERROR|ID)|SYSLOG|U(?:SER|UCP)|WARNING)))|M(?:ON_(?:1(?:0|1|2|)|2|3|4|5|6|7|8|9|DECIMAL_POINT|GROUPING|THOUSANDS_SEP)|_(?:1_PI|2_(?:PI|SQRTPI)|E|L(?:N(?:10|2)|OG(?:10E|2E))|PI(?:_(?:2|4)|)|SQRT(?:1_2|2)))|N(?:EGATIVE_SIGN|O(?:EXPR|STR)|_(?:CS_PRECEDES|S(?:EP_BY_SPACE|IGN_POSN)))|P(?:ATH(?:INFO_(?:BASENAME|DIRNAME|EXTENSION)|_SEPARATOR)|M_STR|OSITIVE_SIGN|_(?:CS_PRECEDES|S(?:EP_BY_SPACE|IGN_POSN)))|RADIXCHAR|S(?:EEK_(?:CUR|END|SET)|ORT_(?:ASC|DESC|NUMERIC|REGULAR|STRING)|TR_PAD_(?:BOTH|LEFT|RIGHT))|T(?:HOUS(?:ANDS_SEP|EP)|_FMT(?:_AMPM|))|YES(?:EXPR|STR))\b/ 
			, _style: "color: red;"
		}
		, global: {
			  _match: /(?:\$GLOBALS|\$_COOKIE|\$_ENV|\$_FILES|\$_GET|\$_POST|\$_REQUEST|\$_SERVER|\$_SESSION|\$php_errormsg)\b/ 
			, _style: "color: red;"
		}
		, keyword: {
			  _match: /\b(?:__CLASS__|__FILE__|__FUNCTION__|__LINE__|__METHOD__|abstract|and|array|as|break|case|catch|cfunction|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exception|exit|extends|extends|final|for|foreach|function|global|if|implements|include|include_once|interface|isset|list|new|old_function|or|php_user_filter|print|private|protected|public|require|require_once|return|static|switch|this|throw|try|unset|use|var|while|xor)\b/ 
			, _style: "color: navy; font-weight: bold;"
		}
		, variable: {
			  _match: /\$(\w+)/
			, _replace: '<span class="keyword">$</span><span class="variable">$1</span>' 
			, _style: "color: #4040c2;"
		}
		, heredoc: {
			  _match: /(\<\<\<\s*)(\w+)((?:(?!\2).*\n)+)(\2)\b/
			, _replace: '<span class="keyword">$1</span><span class="string1">$2</span><span class="string2">$3</span><span class="string1">$4</span>' 
		}
	}
}



ChiliBook.recipes[ "html.js" ] = 
{
	  _name: 'html'
	, _case: false
	, _main: {
		  doctype: { 
			  _match: /<!DOCTYPE\b[\w\W]*?>/ 
			, _style: "color: #CC6600;"
		}
		, ie_style: {
			  _match: /(<!--\[[^\]]*\]>)([\w\W]*?)(<!\[[^\]]*\]-->)/
			, _replace: function( all, open, content, close ) {
				return "<span class='ie_style'>" + this.x( open ) + "</span>" 
					  + this.x( content, '//style' ) 
					  + "<span class='ie_style'>" + this.x( close ) + "</span>";
			}
			, _style: "color: DarkSlateGray; font-weight: bold;"
		}
		, comment: { 
			  _match: /<!--[\w\W]*?-->/ 
			, _style: "color: #4040c2;"
		}
		, script: { 
			  _match: /(<script\s+[^>]*>)([\w\W]*?)(<\/script\s*>)/
			, _replace: function( all, open, content, close ) { 
				  return this.x( open, '//tag_start' ) 
					  + this.x( content, 'js' ) 
					  + this.x( close, '//tag_end' );
			} 
		}
		, style: { 
			  _match: /(<style\s+[^>]*>)([\w\W]*?)(<\/style\s*>)/
			, _replace: function( all, open, content, close ) { 
				  return this.x( open, '//tag_start' ) 
					  + this.x( content, 'css' ) 
					  + this.x( close, '//tag_end' );
			} 
		}
		// matches a starting tag of an element (with attrs)
		// like "<div ... >" or "<img ... />"
		, tag_start: { 
			  _match: /(<\w+)((?:[?%]>|[\w\W])*?)(\/>|>)/ 
			, _replace: function( all, open, content, close ) { 
				  return "<span class='tag_start'>" + this.x( open ) + "</span>" 
					  + this.x( content, '/tag_attrs' ) 
					  + "<span class='tag_start'>" + this.x( close ) + "</span>";
			}
			, _style: "color: navy; font-weight: bold;"
		} 
		// matches an ending tag
		// like "</div>"
		, tag_end: { 
			  _match: /<\/\w+\s*>|\/>/ 
			, _style: "color: navy;"
		}
		, entity: { 
			  _match: /&\w+?;/ 
			, _style: "color: blue;"
		}
	}
	, tag_attrs: {
		// matches a name/value pair
		attr: {
			// before in $1, name in $2, between in $3, value in $4
			  _match: /(\W*?)([\w-]+)(\s*=\s*)((?:\'[^\']*(?:\\.[^\']*)*\')|(?:\"[^\"]*(?:\\.[^\"]*)*\"))/ 
			, _replace: "$1<span class='attr_name'>$2</span>$3<span class='attr_value'>$4</span>"
			, _style: { attr_name:  "color: green;", attr_value: "color: maroon;" }
		}
	}
};



ChiliBook.recipes[ "js.js" ] = 
{
	  _name: 'js'
	, _case: true
	, _main: {
		  ml_comment: { 
			  _match: /\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\//
			, _style: 'color: gray;'
		}
		, sl_comment: { 
			  _match: /\/\/.*/
			, _style: 'color: green;'
		}
		, string: { 
			  _match: /(?:\'[^\'\\\n]*(?:\\.[^\'\\\n]*)*\')|(?:\"[^\"\\\n]*(?:\\.[^\"\\\n]*)*\")/
			, _style: 'color: teal;'
		}
		, num: { 
			  _match: /\b[+-]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?\b/
			, _style: 'color: red;'
		}
		, reg_not: { //this prevents "a / b / c" to be interpreted as a reg_exp
			  _match: /(?:\w+\s*)\/[^\/\\\n]*(?:\\.[^\/\\\n]*)*\/[gim]*(?:\s*\w+)/
			, _replace: function( all ) {
				return this.x( all, '//num' );
			}
		}
		, reg_exp: { 
			  _match: /\/[^\/\\\n]*(?:\\.[^\/\\\n]*)*\/[gim]*/
			, _style: 'color: maroon;'
		}
		, brace: { 
			  _match: /[\{\}]/
			, _style: 'color: red; font-weight: bold;'
		}
		, statement: { 
			  _match: /\b(with|while|var|try|throw|switch|return|if|for|finally|else|do|default|continue|const|catch|case|break)\b/
			, _style: 'color: navy; font-weight: bold;'
		}
		, error: { 
			  _match: /\b(URIError|TypeError|SyntaxError|ReferenceError|RangeError|EvalError|Error)\b/
			, _style: 'color: Coral;'
		}
		, object: { 
			  _match: /\b(String|RegExp|Object|Number|Math|Function|Date|Boolean|Array)\b/
			, _style: 'color: DeepPink;'
		}
		, property: { 
			  _match: /\b(undefined|arguments|NaN|Infinity)\b/
			, _style: 'color: Purple; font-weight: bold;'
		}
		, 'function': { 
			  _match: /\b(parseInt|parseFloat|isNaN|isFinite|eval|encodeURIComponent|encodeURI|decodeURIComponent|decodeURI)\b/
			, _style: 'color: olive;'
		}
		, operator: {
			  _match: /\b(void|typeof|this|new|instanceof|in|function|delete)\b/
			, _style: 'color: RoyalBlue; font-weight: bold;'
		}
		, liveconnect: {
			  _match: /\b(sun|netscape|java|Packages|JavaPackage|JavaObject|JavaClass|JavaArray|JSObject|JSException)\b/
			, _style: 'text-decoration: overline;'
		}
	}
};



ChiliBook.recipes[ "css.js" ] = 
{
	  _name: 'css'
	, _case: true
	, _main: {
		  comment: { 
			  _match: /\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\// 
			, _style: "color: olive;"
		}
		, directive: {
			  _match: /@\w+/
			, _style: "color: fuchsia;"
		}
		, url: {
			  _match: /\b(url\s*\()([^)]+)(\))/
			, _replace: "<span class='url'>$1</span>$2<span class='url'>$3</span>"
			, _style: "color: fuchsia;"
		}
		, block:   {
			  _match: /\{([\w\W]*?)\}/
			, _replace: function( all, pairs ) {
				return '{' + this.x( pairs, '/definition' ) + '}';
			}
		}
		, 'class': {
			  _match: /\.\w+/
			, _style: "color: #CC0066; font-weight: bold;"
		}
		, id:      {
			  _match: /#\w+/
			, _style: "color: IndianRed; font-weight: bold;"
		}
		, pseudo:  {
			  _match: /:\w+/
			, _style: "color: #CC9900;"
		}
		, element: {
			  _match: /\w+/
			, _style: "color: Purple; font-weight: bold;"
		}
	}
	, definition: {
		  comment: { 
			  _match: /\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\//
		}
		, property: {
			  _match: /\b(?:zoom|z-index|writing-mode|word-wrap|word-spacing|word-break|width|widows|white-space|volume|voice-family|visibility|vertical-align|unicode-bidi|top|text-underline-position|text-transform|text-shadow|text-overflow|text-kashida-space|text-justify|text-indent|text-decoration|text-autospace|text-align-last|text-align|table-layout|stress|speech-rate|speak-punctuation|speak-numeral|speak-header|speak|size|scrollbar-track-color|scrollbar-shadow-color|scrollbar-highlight-color|scrollbar-face-color|scrollbar-dark-shadow-color|scrollbar-base-color|scrollbar-arrow-color|scrollbar-3d-light-color|ruby-position|ruby-overhang|ruby-align|right|richness|quotes|position|play-during|pitch-range|pitch|pause-before|pause-after|pause|page-break-inside|page-break-before|page-break-after|page|padding-top|padding-right|padding-left|padding-bottom|padding|overflow-Y|overflow-X|overflow|outline-width|outline-style|outline-color|outline|orphans|min-width|min-height|max-width|max-height|marks|marker-offset|margin-top|margin-right|margin-left|margin-bottom|margin|list-style-type|list-style-position|list-style-image|list-style|line-height|line-break|letter-spacing|left|layout-grid-type|layout-grid-mode|layout-grid-line|layout-grid-char-spacing|layout-grid-char|layout-grid|layout-flow|layer-background-image|layer-background-color|include-source|ime-mode|height|font-weight|font-variant|font-style|font-stretch|font-size-adjust|font-size|font-family|font|float|filter|empty-cells|elevation|display|direction|cursor|cue-before|cue-after|cue|counter-reset|counter-increment|content|color|clip|clear|caption-side|bottom|border-width|border-top-width|border-top-style|border-top-color|border-top|border-style|border-spacing|border-right-width|border-right-style|border-right-color|border-right|border-left-width|border-left-style|border-left-color|border-left|border-color|border-collapse|border-bottom-width|border-bottom-style|border-bottom-color|border-bottom|border|behavior|background-repeat|background-position-y|background-position-x|background-position|background-image|background-color|background-attachment|background|azimuth|accelerator)\s*:/
			, _style: "color: #330066;"
		}
		, special: {
			  _match: /\b(?:-use-link-source|-set-link-source|-replace|-moz-user-select|-moz-user-modify|-moz-user-input|-moz-user-focus|-moz-outline-width|-moz-outline-style|-moz-outline-color|-moz-outline|-moz-opacity|-moz-border-top-colors|-moz-border-right-colors|-moz-border-radius-topright|-moz-border-radius-topleft|-moz-border-radius-bottomright|-moz-border-radius-bottomleft|-moz-border-radius|-moz-border-left-colors|-moz-border-bottom-colors|-moz-binding)\s*:/
			, _style: "color: #330066; text-decoration: underline;"
		}
		, url: {
			  _match: /\b(url\s*\()([^)]+)(\))/
			, _replace: "<span class='url'>$1</span>$2<span class='url'>$3</span>"
		}
		, value: {
			  _match: /\b(?:xx-small|xx-large|x-soft|x-small|x-slow|x-low|x-loud|x-large|x-high|x-fast|wider|wait|w-resize|visible|url|uppercase|upper-roman|upper-latin|upper-alpha|underline|ultra-expanded|ultra-condensed|tv|tty|transparent|top|thin|thick|text-top|text-bottom|table-row-group|table-row|table-header-group|table-footer-group|table-column-group|table-column|table-cell|table-caption|sw-resize|super|sub|status-bar|static|square|spell-out|speech|solid|soft|smaller|small-caption|small-caps|small|slower|slow|silent|show|separate|semi-expanded|semi-condensed|se-resize|scroll|screen|s-resize|run-in|rtl|rightwards|right-side|right|ridge|rgb|repeat-y|repeat-x|repeat|relative|projection|print|pre|portrait|pointer|overline|outside|outset|open-quote|once|oblique|nw-resize|nowrap|normal|none|no-repeat|no-open-quote|no-close-quote|ne-resize|narrower|n-resize|move|mix|middle|message-box|medium|marker|ltr|lowercase|lower-roman|lower-latin|lower-greek|lower-alpha|lower|low|loud|local|list-item|line-through|lighter|level|leftwards|left-side|left|larger|large|landscape|justify|italic|invert|inside|inset|inline-table|inline|icon|higher|high|hide|hidden|help|hebrew|handheld|groove|format|fixed|faster|fast|far-right|far-left|fantasy|extra-expanded|extra-condensed|expanded|embossed|embed|e-resize|double|dotted|disc|digits|default|decimal-leading-zero|decimal|dashed|cursive|crosshair|cross|crop|counters|counter|continuous|condensed|compact|collapse|code|close-quote|circle|center-right|center-left|center|caption|capitalize|braille|bottom|both|bolder|bold|block|blink|bidi-override|below|behind|baseline|avoid|auto|aural|attr|armenian|always|all|absolute|above)\b/
			, _style: "color: #3366FF;"
		}
		, string: { 
			  _match: /(?:\'[^\'\\\n]*(?:\\.[^\'\\\n]*)*\')|(?:\"[^\"\\\n]*(?:\\.[^\"\\\n]*)*\")/ 
			, _style: "color: teal;"
		}
		, number: { 
			  _match: /(?:\b[+-]?(?:\d*\.?\d+|\d+\.?\d*))(?:%|(?:(?:px|pt|em|)\b))/ 
			, _style: "color: red;"
		}
		, color : { 
			  _match: /(?:\#[a-fA-F0-9]{3,6})|\b(?:yellow|white|teal|silver|red|purple|olive|navy|maroon|lime|green|gray|fuchsia|blue|black|aqua|YellowGreen|Yellow|WhiteSmoke|White|Wheat|Violet|Turquoise|Tomato|Thistle|Teal|Tan|SteelBlue|SpringGreen|Snow|SlateGrey|SlateGray|SlateBlue|SkyBlue|Silver|Sienna|SeaShell|SeaGreen|SandyBrown|Salmon|SaddleBrown|RoyalBlue|RosyBrown|Red|Purple|PowderBlue|Plum|Pink|Peru|PeachPuff|PapayaWhip|PaleVioletRed|PaleTurquoise|PaleGreen|PaleGoldenRod|Orchid|OrangeRed|Orange|OliveDrab|Olive|OldLace|Navy|NavajoWhite|Moccasin|MistyRose|MintCream|MidnightBlue|MediumVioletRed|MediumTurquoise|MediumSpringGreen|MediumSlateBlue|MediumSeaGreen|MediumPurple|MediumOrchid|MediumBlue|MediumAquaMarine|Maroon|Magenta|Linen|LimeGreen|Lime|LightYellow|LightSteelBlue|LightSlateGrey|LightSlateGray|LightSkyBlue|LightSeaGreen|LightSalmon|LightPink|LightGrey|LightGreen|LightGray|LightGoldenRodYellow|LightCyan|LightCoral|LightBlue|LemonChiffon|LawnGreen|LavenderBlush|Lavender|Khaki|Ivory|Indigo|IndianRed|HotPink|HoneyDew|Grey|GreenYellow|Green|Gray|GoldenRod|Gold|GhostWhite|Gainsboro|Fuchsia|ForestGreen|FloralWhite|FireBrick|DodgerBlue|DimGrey|DimGray|DeepSkyBlue|DeepPink|Darkorange|DarkViolet|DarkTurquoise|DarkSlateGrey|DarkSlateGray|DarkSlateBlue|DarkSeaGreen|DarkSalmon|DarkRed|DarkOrchid|DarkOliveGreen|DarkMagenta|DarkKhaki|DarkGrey|DarkGreen|DarkGray|DarkGoldenRod|DarkCyan|DarkBlue|Cyan|Crimson|Cornsilk|CornflowerBlue|Coral|Chocolate|Chartreuse|CadetBlue|BurlyWood|Brown|BlueViolet|Blue|BlanchedAlmond|Black|Bisque|Beige|Azure|Aquamarine|Aqua|AntiqueWhite|AliceBlue)\b/ 
			, _style: "color: green;"
		}
	}
};


