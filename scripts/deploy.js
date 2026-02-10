console.clear()
const argv = require('yargs').argv
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const Listr = require('listr')
const execa = require('execa')
const WebDAV = require('webdav-fs')

const TARGETS = {
  sandbox: {
    storeHash: 'sq95sgetne',
    webdavPassword: 'bae69ee1175f9509fbfa74a5da468681',
    b2bClientId: 'dl7c39mdpul6hyc489yk0vzxl6jesyx',
    captchaSiteKey: '6LcimW8qAAAAAPv4SYGjQD8HejLmKu2JP4laQL0W',
  },
  production: {
    storeHash: 'nldoq9l1qv',
    webdavPassword: '476de323f122185fc8b11e12f6d28c3c442e1bc2',
    b2bClientId: '8835u50lkd4dat1xxdx4l2o2yos7184',
    captchaSiteKey: '6LcimW8qAAAAAPv4SYGjQD8HejLmKu2JP4laQL0W',
  },
}

const targetName = argv.target || (argv.sandbox && 'sandbox') || (argv.production && 'production')

if (!targetName || !TARGETS[targetName]) {
  console.error(chalk.red(`\nUsage: node scripts/deploy.js --target <sandbox|production> [--dev]\n`))
  console.error(`  --target sandbox     Deploy to the sandbox BigCommerce store`)
  console.error(`  --target production  Deploy to the production BigCommerce store`)
  console.error(`  --dev                Build only (dry run, no upload)\n`)
  process.exit(1)
}

const target = TARGETS[targetName]
const DRY_RUN = !!argv.dev

const config = {
  WEBDAV_USERNAME: 'domains@mojoactive.com',
  WEBDAV_PASSWORD: target.webdavPassword,
  WEBDAV_STOREHASH: target.storeHash,
}

console.log(chalk.cyan(`\n  Target: ${targetName} (${config.WEBDAV_STOREHASH})`))
if (DRY_RUN) console.log(chalk.yellow(`  Mode:   DRY RUN (build only, no upload)\n`))
else console.log()


// WebDAV helpers

const WebDAVHelper = {
  Connect: () => {
    return WebDAV(
      `https://store-${config.WEBDAV_STOREHASH}.mybigcommerce.com/dav`,
      {
        username: config.WEBDAV_USERNAME,
        password: config.WEBDAV_PASSWORD,
        digest: true,
      }
    )
  },
  MakeDir: (dirPath) => {
    return new Promise(function (resolve, reject) {
      const wfs = WebDAVHelper.Connect()
      wfs.mkdir(`${dirPath}`, function (err) {
        if (err) return reject(err)
        resolve(true)
      })
    })
  },
  UploadFiles: (src, dest, files) => {
    return new Promise(async function (resolve, reject) {
      const wfs = await WebDAVHelper.Connect()
      const uploader = (file) => {
        return new Promise(async (resolve, reject) => {
          const contents = fs.readFileSync(path.join(src, file))
          wfs.writeFile(`${dest}/${file}`, contents, (err) => {
            if (err) reject(err)
            resolve()
          })
        })
      }

      const filesToUpload = files.filter((o) => o.includes('.'))
      const batchSize = 4

      for (let i = 0; i < filesToUpload.length; i += batchSize) {
        const batch = filesToUpload.slice(i, i + batchSize)
        await Promise.all(batch.map((file) => uploader(file)))
      }

      resolve()
    })
  },
}

const NodeHelper = {
  ListFiles: (_path) => {
    return new Promise((resolve, reject) => {
      fs.readdir(_path, function (err, files) {
        if (err) return reject(err)
        resolve(files)
      })
    })
  },
}


// environment configs

const envPath = path.join(__dirname, '../apps/storefront/.env')
let originalEnv = null

function setEnvForBuild(assetsAbsolutePath) {
  originalEnv = fs.readFileSync(envPath, 'utf8')
  let env = originalEnv
  env = env.replace(/VITE_ENVIRONMENT=.*/, `VITE_ENVIRONMENT=${targetName}`)
  env = env.replace(/VITE_ASSETS_ABSOLUTE_PATH=.*/, `VITE_ASSETS_ABSOLUTE_PATH="${assetsAbsolutePath}/assets/"`)
  fs.writeFileSync(envPath, env)
}

function restoreEnv() {
  if (originalEnv !== null) {
    fs.writeFileSync(envPath, originalEnv)
    originalEnv = null
  }
}

process.on('exit', restoreEnv)
process.on('SIGINT', () => { restoreEnv(); process.exit(130) })
process.on('uncaughtException', (err) => { restoreEnv(); throw err })


// task runner

let timestamp
let absolutePath

const tasks = new Listr([
  {
    title: 'Pre-Deploy Setup',
    task: async (ctx, task) => {
      return new Promise(async (resolve, reject) => {
        try {
          task.output = 'Creating a new versioned folder...'
          ctx.timestamp = timestamp = new Date()
            .toISOString()
            .replace(/\:/g, '_')
            .replace('T', '')
            .replace(/\..+/, '')
          ctx.destFolder = `/content/b2b-portal/${ctx.timestamp}`

          if (!DRY_RUN) {
            try {
              await WebDAVHelper.MakeDir(`/content/b2b-portal`)
            } catch (ex) {}
            await WebDAVHelper.MakeDir(ctx.destFolder)
            await WebDAVHelper.MakeDir(`${ctx.destFolder}/assets`)
          }

          absolutePath = `https://cdn11.bigcommerce.com/s-${config.WEBDAV_STOREHASH}/content/b2b-portal/${ctx.timestamp}`
          setEnvForBuild(absolutePath)

          resolve()
        } catch (ex) {
          task.title = `Pre-Deploy Setup Failed`
          reject(ex)
          throw new Error(ex.message)
        }
      })
    },
  },
  {
    title: 'Build B2B Portal',
    task: (ctx, task) => {
      task.output = 'Building...'
      return execa('yarn', ['run', 'build']).catch((reason) => {
        task.title = `Build failed`
        throw new Error(reason.message)
      })
    },
  },
  {
    title: 'Restore .env',
    task: () => restoreEnv(),
  },
  {
    title: 'Deploy B2B Portal',
    skip: () => DRY_RUN && 'Dry run — skipping upload',
    task: async (ctx, task) => {
      return new Promise(async (resolve, reject) => {
        await new Promise((resolve) => setTimeout(resolve, 3000))

        try {
          task.output = 'Getting a list of files and folders to upload...'
          ctx.distFolder = path.join(__dirname, '../apps/storefront/dist')
          ctx.distStaticFolder = path.join(__dirname, '../apps/storefront/dist/assets')
          ctx.distFiles = await NodeHelper.ListFiles(ctx.distFolder)
          ctx.distStaticFiles = await NodeHelper.ListFiles(ctx.distStaticFolder)
          ctx.fileCount = []
            .concat(ctx.distFiles, ctx.distStaticFiles)
            .filter((o) => o.includes('.')).length

          task.output = `Uploading ${ctx.fileCount} files...`
          await WebDAVHelper.UploadFiles(ctx.distFolder, ctx.destFolder, ctx.distFiles)
          await WebDAVHelper.UploadFiles(ctx.distStaticFolder, `${ctx.destFolder}/assets`, ctx.distStaticFiles)
          resolve()
        } catch (ex) {
          task.title = `Deployment failed`
          reject(ex)
          throw new Error(ex.message)
        }
      })
    },
  },
])


// post-deploy

const finished = () => {
  console.log(`  ${chalk.green('√')} Finished`)
  console.log()

  if (DRY_RUN) {
    console.log('\n🎉 Build complete (dry run — nothing uploaded).')
    return
  }

  const distDir = './apps/storefront/dist'
  const indexFileHash = fs.readdirSync(distDir).find((o) => o.includes('index.')).split('.')[1]
  const polyfillsFileHash = fs.readdirSync(distDir).find((o) => o.includes('polyfills-legacy.')).split('.')[1]
  const indexLegacyFileHash = fs.readdirSync(distDir).find((o) => o.includes('index-legacy.')).split('.')[1]

  const template = `<script>
  window.customerId = "{{customer.id}}";
  window.b3CheckoutConfig = {
    routes: {
      dashboard: '/account.php?action=order_status',
    },
  }
  window.B3 = {
    setting: {
      store_hash: '${config.WEBDAV_STOREHASH}',
      channel_id: 1,
      platform: 'bigcommerce',
      b2b_url: 'https://api-b2b.bigcommerce.com',
      captcha_setkey: '${target.captchaSiteKey}',
    },
    'dom.checkoutRegisterParentElement': '#checkout-app',
    'dom.registerElement':
      '[href^="/login.php"], #checkout-customer-login, [href="/login.php"] .navUser-item-loginLabel, #checkout-customer-returning .form-legend-container [href="#"]',
    'dom.openB3Checkout': 'checkout-customer-continue',
    before_login_goto_page: '/account.php?action=order_status',
    checkout_super_clear_session: 'true',
    'dom.navUserLoginElement': '.navUser-item.navUser-item--account',
  }
</script>
<script
  type="module"
  crossorigin=""
  src="${absolutePath}/index.${indexFileHash}.js"
></script>
<script
  nomodule=""
  crossorigin=""
  src="${absolutePath}/polyfills-legacy.${polyfillsFileHash}.js"
></script>
<script
  nomodule=""
  crossorigin=""
  src="${absolutePath}/index-legacy.${indexLegacyFileHash}.js"
></script>`

  console.log(chalk.magentaBright('---------------------------------------'))
  console.log(chalk.magentaBright('Manual Step Required'))
  console.log(chalk.magentaBright('---------------------------------------'))
  console.log(
    'A final step is required to change the storefront to the newly deployed build.'
  )
  console.log()
  console.log(
    `1. Go to ${chalk.blue(
      `https://store-${config.WEBDAV_STOREHASH}.mybigcommerce.com/manage/channel/1/script-manager`
    )}`
  )
  console.log(`2. Replace the existing script tags with the following:`)
  console.log(chalk.greenBright(template))
  console.log(`3. Click Save`)
  console.log(`\n🎉 Deployed to ${chalk.bold(targetName)}!`)
}

tasks.run().then(finished)
