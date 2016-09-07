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

let prefix = 'wikihub.io: Autocomplete internal links: '

function formatErrorMessage (err) {
  return `${prefix}${err}`
}

let templateUtil = {
  buildHTML: (strings, ...values) => {
    return strings[0] + strings.slice(1).map((str, index) => {
      return templateUtil.escapeHTML(values[index]) + str
    }).join('')
  },
  escapeHTML: (string) => {
    return string.toString()
      .replace('&', '&amp;')
      .replace('<', '&lt;')
      .replace('>', '&gt;')
      .replace('"', '&quot;')
      .replace("'", '&#39;')
  },
  ymdDate: (date) => {
    return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`
  }
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
    publishedAt: new Date(entry.querySelector('published').textContent.trim()),
    updatedAt: new Date(entry.querySelector('updated').textContent.trim()),
    url: entry.querySelector('link[rel="alternate"][type="text/html"]').getAttribute('href')
  }
}

let sourceCache = {
  load: () => {
    let json = localStorage.getItem(`${prefix}sources`)
    if (!json) return null
    let sources = JSON.parse(json)
    for (let source of sources) {
      source.publishedAt = new Date(source.publishedAt)
      source.updatedAt = new Date(source.publishedAt)
    }
    return sources
  },
  save: (sources) => localStorage.setItem(`${prefix}sources`, JSON.stringify(sources))
}

function fetchSources (rootURL) {
  let cache = sourceCache.load()
  if (cache) {
    return Promise.resolve(cache)
  }

  let sources = []
  let handlers = [
    {
      url: `${rootURL}articles.atom`,
      addAttrs: (source, entry) => {
        source.type = 'article'
        source.thumbnail = entry.querySelector('thumbnail').getAttribute('url')
      }
    },
    {
      url: `${rootURL}wiki.atom`,
      addAttrs: (source) => {
        source.type = 'page'
      }
    }
  ]
  let promise = handlers.reduce((promise, { url, addAttrs }) => {
    return promise.then(() => {
      return jQuery.ajax({ url, dataType: 'xml' }).then((doc) => {
        Array.from(doc.querySelectorAll('feed > entry'), (entry) => {
          let source = entryToSource(entry)
          addAttrs(source, entry)
          sources.push(source)
        })
      })
    }).catch((error) => {
      if (error.status === 404) {
        return Promise.resolve()
      } else {
        return Promise.reject(error)
      }
    })
  }, Promise.resolve())
  return promise.then(
    () => {
      sourceCache.save(sources)
      return sources
    },
    (err) => {
      console.error(formatErrorMessage(err))
      return Promise.resolve(sources)
    })
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
          sources.forEach((source) => { source.name = query })
          callback(sources.filter((source) => {
            return normalize(source.title).includes(query) ||
              (source.type === 'article' && normalize(source.author).includes(query))
          }))
        })
        .catch((err) => {
          console.error(formatErrorMessage(err))
        })
    }
  },
  displayTpl: function (candidate) {
    switch (candidate.type) {
      case 'article':
        return templateUtil.buildHTML`
<li class="list-group-item media">
  <div class="pull-left">
    <img class="avatar-img" title="@${candidate.author}" src="${candidate.thumbnail}" width="40" height="40">
  </div>
  <div class="media-body">
    <div class="lgi-heading">${candidate.title}</div>
    <div class="lgi-text">Created on ${templateUtil.ymdDate(candidate.publishedAt)} by ${candidate.author}</div>
  </div>
</li>`
      case 'page':
        return templateUtil.buildHTML`
<li class="list-group-item media">
  <div class="pull-left">
    <div class="avatar-char palette-Grey-500 bg">
      <i class="fa fa-sitemap"></i>
    </div>
  </div>
  <div class="media-body">
    <div class="lgi-heading">${candidate.title}</div>
    <div class="lgi-text">Updated on ${templateUtil.ymdDate(candidate.updatedAt)}</div>
  </div>
</li>`
    }
  },
  insertTpl: function (candidate) {
    return `[${candidate.title}](${candidate.url})`
  }
})
