import { satisfies } from 'semver'

if (!satisfies(process.version, '>=11.0.0 <17.0.0')) {
  console.error(
    'Invalid Node.js version. Please use Node.js versions >=11.0.0 and <17.0.0"'
  )
  process.exit(1)
}
