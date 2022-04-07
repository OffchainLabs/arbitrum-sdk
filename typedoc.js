module.exports = {
  entryPoints: ['./src/lib'],
  out: 'docs',
  exclude: ['./src/lib/abi'],
  excludeNotDocumented: true,
  excludeInternal: true,
  entryPointStrategy: 'expand',
  readme: './readme.doc.md',
}
