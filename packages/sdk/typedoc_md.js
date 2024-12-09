// References:
//  - https://typedoc.org/guides/overview/
//  - https://github.com/tgreyuk/typedoc-plugin-markdown

/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  // Input options
  entryPoints: ['./src/lib'],
  entryPointStrategy: 'expand',
  exclude: ['./src/lib/abi'],
  excludeNotDocumented: true,
  excludeInternal: true,

  // Output options
  out: 'docs',

  // Plugins
  plugin: ['typedoc-plugin-markdown'],

  // typedoc-plugin-markdown options
  // entryDocument: 'modules.md',
  hideBreadcrumbs: true,
  hideInPageTOC: true,
  hideMembersSymbol: true,
}
