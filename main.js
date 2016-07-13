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
    let xhr = new XMLHttpRequest()
    xhr.open('GET', rootURL)
    xhr.onload = function () {
      if (xhr.status !== 200) return
      let sources = Object.create(null)
      let links = xhr.responseXML.querySelectorAll('a.list-group-item.media[href]')
      for (let link of links) {
        if (link.host === rootURL.host &&
            (link.pathname.startsWith('/wiki/') || link.pathname.startsWith('/@'))) {
          let title = link.querySelector('.lgi-heading').textContent.trim()
          sources[title] = link.href
        }
      }
      resolve(_sourceDirectCache = sources)
    }
    xhr.responseType = 'document'
    xhr.send()
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
