const glob = require('glob')
const { readFile, writeFile } = require('fs')

glob('./docs/**/*', function (err, res) {
  if (err) {
    console.log('Error', err)
  } else {
    for (const path of res) {
      if (!path.endsWith('.md')) continue
      readFile(path, 'utf-8', function (err, contents) {
        if (err) {
          console.log(err)
          return
        }
        // Fix JSX md rendering breaking tags:
        const replaced = contents.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        writeFile(path, replaced, 'utf-8', function (err) {
          if (err) console.warn('Error', err)
        })
      })
    }
  }
})
