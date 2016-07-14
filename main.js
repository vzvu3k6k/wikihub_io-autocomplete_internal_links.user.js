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

function escapeHTML (string) {
  return string.toString().replace('&', '&amp;')
    .replace('<', '&lt;')
    .replace('>', '&gt;')
    .replace('"', '&quot;')
    .replace("'", '&#39;')
}

function HTMLtemplate (strings, ...values) {
  return strings[0] + strings.slice(1).map((str, index) => {
    return escapeHTML(values[index]) + str
  }).join('')
}

function ymdDate (date) {
  return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`
}

let style = document.createElement('style')
style.textContent = `
/* textcomplete関連のスタイルはWikiHub側で指定されている */

.ujs-autocomplete-internal-links.dropdown-menu.textcomplete-dropdown {
  /* インラインスタイルによってheightが大きく設定されるのを雑に抑制 */
  height: auto !important;
}

.ujs-autocomplete-internal-links.dropdown-menu .list-group-item {
  border: none;
}

.ujs-autocomplete-internal-links.dropdown-menu > li > a {
  padding: 0;
}
`
document.head.appendChild(style)

let jQuery = require('jquery')
require('jquery-textcomplete')

function entryToSource (entry) {
  return {
    author: entry.querySelector('author > name').textContent.trim(),
    title: entry.querySelector('title').textContent.trim(),
    publishedAt: new Date(Date.parse(entry.querySelector('published').textContent.trim())),
    updatedAt: new Date(Date.parse(entry.querySelector('updated').textContent.trim())),
    url: entry.querySelector('link[rel="alternate"][type="text/html"]').getAttribute('href')
  }
}

let _sourceCache
function fetchSources (rootURL) {
  return _sourceCache || (_sourceCache = new Promise((resolve, reject) => {
    let sources = []
    jQuery.ajax({
      url: `${rootURL}articles.atom`,
      dataType: 'xml'
    }).then((doc) => {
      Array.from(doc.querySelectorAll('feed > entry'), (entry) => {
        let source = entryToSource(entry)
        source.type = 'article'
        source.thumbnail = entry.querySelector('thumbnail').getAttribute('url')
        sources.push(source)
      })
    }).fail((error) => {
      if (error.status === 404) {
        return Promise.resolve()
      } else {
        return Promise.reject(error)
      }
    }).then(() => {
      return jQuery.ajax({
        url: `${rootURL}wiki.atom`,
        dataType: 'xml'
      })
    }).then((doc) => {
      Array.from(doc.querySelectorAll('feed > entry'), (entry) => {
        let source = entryToSource(entry)
        source.type = 'page'
        sources.push(source)
      })
    }).then(
      () => resolve(sources),
      (err) => {
        if (sources.length > 0) {
          resolve(sources)
        } else {
          reject(err)
        }
      })
  }))
}

jQuery('textarea').textcomplete([{
  match: /\[(.{2,})$/,
  index: 1,
  search: (term, callback) => {
    term = term.toLowerCase()
    fetchSources(new URL(`https://${location.hostname}/`))
      .then((sources) => {
        callback(sources.filter((source) => {
          return source.title.toLowerCase().includes(term) ||
            source.author.toLowerCase().includes(term)
        }))
      })
  },
  template: (source) => {
    switch (source.type) {
    case 'article':
      return HTMLtemplate`
<span class="list-group-item media">
  <div class="pull-left">
    <img class="avatar-img" title="@${source.author}" src="${source.thumbnail}" width="40" height="40">
  </div>
  <div class="media-body">
    <div class="lgi-heading">${source.title}</div>
    <div class="lgi-text">Created on ${ymdDate(source.publishedAt)} by ${source.author}</div>
  </div>
</span>`
    case 'page':
      return HTMLtemplate`
<span class="list-group-item media">
  <div class="pull-left">
    <div class="avatar-char palette-Grey-500 bg">
      <i class="fa fa-sitemap"></i>
    </div>
  </div>
  <div class="media-body">
    <div class="lgi-heading">${source.title}</div>
    <div class="lgi-text">Updated on ${ymdDate(source.updatedAt)}</div>
  </div>
</span>`
    }
  },
  replace: (source) => {
    return `[${source.title}](${source.url})`
  }
}], {
  dropdownClassName: 'dropdown-menu textcomplete-dropdown ujs-autocomplete-internal-links'
})
