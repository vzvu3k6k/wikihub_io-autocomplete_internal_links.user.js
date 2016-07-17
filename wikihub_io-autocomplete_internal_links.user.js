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
#at-view-ujs-autocomplete-internal-links.atwho-view .cur {
  background-color: #f5f5f5;
}

#at-view-ujs-autocomplete-internal-links .list-group-item {
  border: none;
}

#at-view-ujs-autocomplete-internal-links .list-group-item > a {
  padding: 0;
}
`
document.head.appendChild(style)

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
    jQuery.ajax({ url: `${rootURL}articles.atom` }).then((doc) => {
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
      return jQuery.ajax({ url: `${rootURL}wiki.atom` })
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

jQuery('.js-autocompletion').atwho({
  at: '[',
  alias: 'ujs-autocomplete-internal-links',
  callbacks: {
    remoteFilter: (query, callback) => {
      if (query.length === 0) {
        callback([])
        return
      }
      function normalize (str) {
        return str.trim().toLowerCase()
      }
      query = normalize(query)
      fetchSources(new URL(`https://${location.hostname}/`))
        .then((sources) => {
          sources.forEach((source) => source.name = query)
          callback(sources.filter((source) => {
            return normalize(source.title).includes(query) ||
              (source.type === 'article' && normalize(source.author).includes(query))
          }))
        })
    },
  },
  displayTpl: function (candidate) {
    switch (candidate.type) {
    case 'article':
      return HTMLtemplate`
<li class="list-group-item media">
  <div class="pull-left">
    <img class="avatar-img" title="@${candidate.author}" src="${candidate.thumbnail}" width="40" height="40">
  </div>
  <div class="media-body">
    <div class="lgi-heading">${candidate.title}</div>
    <div class="lgi-text">Created on ${ymdDate(candidate.publishedAt)} by ${candidate.author}</div>
  </div>
</li>`
    case 'page':
      return HTMLtemplate`
<li class="list-group-item media">
  <div class="pull-left">
    <div class="avatar-char palette-Grey-500 bg">
      <i class="fa fa-sitemap"></i>
    </div>
  </div>
  <div class="media-body">
    <div class="lgi-heading">${candidate.title}</div>
    <div class="lgi-text">Updated on ${ymdDate(candidate.updatedAt)}</div>
  </div>
</li>`
    }
  },
  insertTpl: function (candidate) {
    return `[${candidate.title}](${candidate.url})`
  }
})
