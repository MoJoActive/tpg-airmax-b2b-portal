console.clear()
const argv = require('yargs').argv
const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const Listr = require('listr')
const execa = require('execa')
const WebDAV = require('webdav-fs')
const { glob } = require('glob')

const isProd = true;
const config = {
  WEBDAV_USERNAME: 'domains@mojoactive.com',
  WEBDAV_PASSWORD: isProd ? '476de323f122185fc8b11e12f6d28c3c442e1bc2' : 'bae69ee1175f9509fbfa74a5da468681',
  WEBDAV_STOREHASH: isProd ? 'nldoq9l1qv' : 'sq95sgetne',
  TEST_MODE: argv.dev,
}

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
  MakeDir: (path) => {
    return new Promise(function (resolve, reject) {
      const wfs = WebDAVHelper.Connect()
      wfs.mkdir(`${path}`, function (err) {
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
          const contents = fs.readFileSync(`${src}\\${file}`)
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

let timestamp
let absolutePath

const tasks = new Listr([
  {
    title: 'Pre-Deploy Setup',
    task: async (ctx, task) => {
      return new Promise(async (resolve, reject) => {
        try {
          // ----------------------------------
          // Create a new deployment slot on WebDAV
          // ----------------------------------
          task.output = 'Creating a new versioned folder...'
          ctx.timestamp = timestamp = new Date()
            .toISOString()
            .replace(/\:/g, '_')
            .replace('T', '')
            .replace(/\..+/, '')
          ctx.destFolder = `/content/b2b-portal/${ctx.timestamp}`
          try {
            await WebDAVHelper.MakeDir(`/content/b2b-portal`)
          } catch (ex) {}
          await WebDAVHelper.MakeDir(ctx.destFolder)
          await WebDAVHelper.MakeDir(`${ctx.destFolder}/assets`)

          // in the .env file, replase the VITE_ASSETS_ABSOLUTE_PATH with the new path
          const envPath = path.join(__dirname, '../apps/storefront/.env')
          const env = fs.readFileSync(envPath, 'utf8')
          absolutePath = `https://cdn11.bigcommerce.com/s-${config.WEBDAV_STOREHASH}/content/b2b-portal/${ctx.timestamp}`
          const newEnv = env.replace(
            /VITE_ASSETS_ABSOLUTE_PATH=.+/,
            `VITE_ASSETS_ABSOLUTE_PATH="${absolutePath}/assets/"`
          )
          fs.writeFileSync(envPath, newEnv)

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
      return execa('npm', ['run', 'build']).catch((reason) => {
        task.title = `Build failed`
        throw new Error(reason.message)
      })
    },
  },
  {
    title: 'Deploy B2B Portal',
    task: async (ctx, task) => {
      if (config.TEST_MODE) return;

      return new Promise(async (resolve, reject) => {
        // wait for 1 second
        await new Promise((resolve, reject) => setTimeout(resolve, 3000))

        try {
          // ----------------------------------
          // Get a list of files/folders to upload
          // ----------------------------------
          task.output = 'Getting a list of files and folder to upload...'
          ctx.distFolder = path.join(__dirname, '../apps/storefront/dist')
          ctx.distStaticFolder = path.join(
            __dirname,
            '../apps/storefront/dist/assets'
          )
          ctx.distFiles = await NodeHelper.ListFiles(ctx.distFolder)
          ctx.distStaticFiles = await NodeHelper.ListFiles(ctx.distStaticFolder)
          ctx.fileCount = []
            .concat(ctx.distFiles, ctx.distStaticFiles)
            .filter((o) => o.includes('.')).length

          // ----------------------------------
          // Upload all the files to WebDAV
          // ----------------------------------
          task.output = `Uploading ${ctx.fileCount} files...`
          await WebDAVHelper.UploadFiles(
            ctx.distFolder,
            ctx.destFolder,
            ctx.distFiles
          )
          await WebDAVHelper.UploadFiles(
            ctx.distStaticFolder,
            `${ctx.destFolder}/assets`,
            ctx.distStaticFiles
          )
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

const finished = () => {
  console.log(`  ${chalk.green('√')} Finished`)
  console.log()

  if (config.TEST_MODE) {
    console.log('\n🎉 Thanks for building!')
    return;
  }

  console.log(chalk.magentaBright('---------------------------------------'))
  console.log(chalk.magentaBright('Manual Step Required'))
  console.log(chalk.magentaBright('---------------------------------------'))
  console.log(
    'A final step is required to change the storefront checkout to the newly deployed checkout.'
  )
  console.log()
  console.log(
    `1. Go to ${chalk.blue(
      `https://store-${config.WEBDAV_STOREHASH}.mybigcommerce.com/manage/channel/1/script-manager`
    )}`
  )

  const indexFileHash = fs
    .readdirSync('./apps/storefront/dist')
    .find((o) => o.includes('index.'))
    .split('.')[1]
  const polyfillsFileHash = fs
    .readdirSync('./apps/storefront/dist')
    .find((o) => o.includes('polyfills-legacy.'))
    .split('.')[1]
  const indexLegacyFileHash = fs
    .readdirSync('./apps/storefront/dist')
    .find((o) => o.includes('index-legacy.'))
    .split('.')[1]

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
      captcha_setkey: '6LcimW8qAAAAAPv4SYGjQD8HejLmKu2JP4laQL0W',
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
  src="${absolutePath}/index.${indexFileHash}"
></script>
<script
  nomodule=""
  crossorigin=""
  src="${absolutePath}/polyfills-legacy.${polyfillsFileHash}"
></script>
<script
  nomodule=""
  crossorigin=""
  src="${absolutePath}/index-legacy.${indexLegacyFileHash}"
></script>`

  console.log(`2. Replace the existing script tags with the following:`)
  console.log(chalk.greenBright(template))

  console.log(`3. Click Save`)
  console.log('\n🎉 Thanks for deploying!')
}

tasks.run().then(finished)