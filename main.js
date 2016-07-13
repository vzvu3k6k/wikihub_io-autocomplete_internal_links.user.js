// ==UserScript==
// @name           wikihub.io: Autocomplete internal links
// @description    Autocomplete links to the pages in the current community on textarea
// @version        0.0.1
// @match          https://*.wikihub.io/*
// @grant          none
// @noframes
// @namespace      http://vzvu3k6k.tk/
// @license        CC0-1.0
// ==/UserScript==

// Thanks to https://nippo.wikihub.io/@yuta25/20160701125959

let style = document.createElement('style')
style.textContent = `
/* textcomplete関連のスタイルはWikiHub側で指定されている */
.dropdown-menu.textcomplete-dropdown.ujs-autocomplete-internal-links {
  /* インラインスタイルによってheightが大きく設定されるのを雑に抑制 */
  height: auto !important;
}
`
document.head.appendChild(style)

let jQuery = require('jquery')
require('jquery-textcomplete')

let _sourceCache, _sourceDirectCache
function fetchSourcesFromTopPage (rootURL) {
  return _sourceCache || (_sourceCache = new Promise((resolve, reject) => {
    jQuery.ajax({
      url: `${rootURL}articles.atom`,
      dataType: 'xml'
    }).then((doc) => {
      let sources = Object.create(null)
      Array.from(doc.querySelectorAll('feed > entry'), (entry) => {
        let title = entry.querySelector('title').textContent.trim()
        let url = entry.querySelector('link[rel="alternate"][type="text/html"]').getAttribute('href')
        sources[title] = url
      })
      return _sourceDirectCache = sources
    }).then(resolve, reject)
  }))
}

jQuery('textarea').textcomplete([{
  match: /\[(\w{2,})$/,
  index: 1,
  search: (term, callback) => {
    fetchSourcesFromTopPage(new URL(`https://${location.hostname}/`))
      .then((sources) => {
        console.log(sources)
        callback(Object.keys(sources).filter((key) => key.includes(term)))
      })
  },
  replace: (title) => {
    return `[${title}](${_sourceDirectCache[title]})`
  }
}], {
  dropdownClassName: 'dropdown-menu textcomplete-dropdown ujs-autocomplete-internal-links'
})
