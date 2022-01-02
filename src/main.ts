import fs from 'fs'
import yargs from 'yargs'
import DLsite from './dlsite'

const getUserName = (args: {
  [x: string]: unknown
  username: string | undefined
  password: string | undefined
  configFile: string | undefined
  _: (string | number)[]
  $0: string
}) => {
  if (args.username) {
    return args.username
  }
  if (args.configFile) {
    return JSON.parse(fs.readFileSync(args.configFile, 'utf8')).username
  }
  if (process.env.DLSITE_USERNAME) {
    return process.env.DLSITE_USERNAME
  }

  return null
}

const getPassWord = (args: {
  [x: string]: unknown
  username: string | undefined
  password: string | undefined
  configFile: string | undefined
  _: (string | number)[]
  $0: string
}) => {
  if (args.password) {
    return args.password
  }
  if (args.configFile) {
    return JSON.parse(fs.readFileSync(args.configFile, 'utf8')).password
  }
  if (process.env.DLSITE_PASSWORD) {
    return process.env.DLSITE_PASSWORD
  }

  return null
}

;(async () => {
  const args = yargs
    .usage('Usage: $0 <command> [options]')
    .option('username', {
      alias: 'u',
      describe: 'DLsite username',
      type: 'string',
    })
    .option('password', {
      alias: 'p',
      describe: 'DLsite password',
      type: 'string',
    })
    .option('config-file', {
      alias: 'conf',
      describe: 'Config file path',
      type: 'string',
    })
    .help()
    .parseSync()

  const username = getUserName(args)
  const password = getPassWord(args)

  if (!username || !password) {
    console.error('username or password is not specified')
    process.exit(1)
  }

  const dlsite = new DLsite({
    username,
    password,
  })
  console.log(dlsite.favorites)
})()
