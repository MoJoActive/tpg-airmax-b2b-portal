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
  UploadFiles: async (src, dest, files, onUpload) => {
    const filesToUpload = files.filter((file) => file.includes('.'))
    const maxAttempts = 4
    let wfs = WebDAVHelper.Connect()

    for (const [index, file] of filesToUpload.entries()) {
      const contents = await fs.promises.readFile(path.join(src, file))
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        onUpload(`${index + 1}/${filesToUpload.length} ${file} (attempt ${attempt}/${maxAttempts})`)
        try {
          await new Promise((resolve, reject) => {
            wfs.writeFile(`${dest}/${file}`, contents, (err) => {
              if (err) reject(err)
              else resolve()
            })
          })
          break
        } catch (err) {
          const status = Number(err.statusCode || err.response?.statusCode || 0)
          const retryable = [408, 429, 500, 502, 503, 504].includes(status) ||
            (!status && /^(ERR_SSL_|ECONNRESET$|ECONNABORTED$|ETIMEDOUT$|EPIPE$|EAI_AGAIN$)/.test(err.code))
          if (!retryable || attempt === maxAttempts) {
            const safeCode = /^[A-Z][A-Z0-9_]*$/.test(err.code) ? err.code : 'request failed'
            throw new Error(`Could not upload ${dest}/${file} (${status || safeCode}).`)
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
          wfs = WebDAVHelper.Connect()
        }
      }
    }
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
      return execa('yarn', ['run', 'build']).catch((reason) => {
        task.title = `Build failed`
        throw new Error(reason.message)
      })
    },
  },
  {
    title: 'Deploy B2B Portal',
    task: async (ctx, task) => {
      if (config.TEST_MODE) return;

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
          ctx.distFiles,
          (progress) => { task.output = `Uploading portal files: ${progress}` }
        )
        await WebDAVHelper.UploadFiles(
          ctx.distStaticFolder,
          `${ctx.destFolder}/assets`,
          ctx.distStaticFiles,
          (progress) => { task.output = `Uploading assets: ${progress}` }
        )
      } catch (ex) {
        task.title = `Deployment failed`
        throw ex
      }
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
    'A final step is required to point the Airmax theme at the newly deployed Buyer Portal.'
  )
  console.log(
    chalk.yellow(
      'The portal is loaded from the theme (inside customer-group conditions), NOT Script Manager. Do not add these tags to Script Manager.'
    )
  )
  console.log()
  console.log(
    `1. Open ${chalk.blue('TPG-Airmax-Theme/templates/components/common/navigation.html')}`
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
  src="${absolutePath}/index.${indexFileHash}${isProd ? '.js' : ''}"
></script>
<script
  nomodule=""
  crossorigin=""
  src="${absolutePath}/polyfills-legacy.${polyfillsFileHash}${isProd ? '.js' : ''}"
></script>
<script
  nomodule=""
  crossorigin=""
  src="${absolutePath}/index-legacy.${indexLegacyFileHash}${isProd ? '.js' : ''}"
></script>`

  console.log(
    `2. Replace the three b2b-portal <script src> URLs with the ones below (leave the window.B3 config and the {{#all ...}} conditions as they are):`
  )
  console.log(chalk.greenBright(template))

  console.log(`3. Upload the theme, test on a preview theme, then apply it`)
  console.log('\n🎉 Thanks for deploying!')
}

tasks.run().then(finished).catch((err) => {
  console.error(chalk.red(err.message))
  process.exitCode = 1
})
