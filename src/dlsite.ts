import fs from 'fs'
import puppeteer, { LaunchOptions, Page } from 'puppeteer'

export interface DLsiteConfig {
  username: string
  password: string

  cookiePath?: string
  isIgnoreCookie?: boolean
  puppeteerOptions?: LaunchOptions
}

export interface DLsiteUser {
  id: string
  name: string
  link: string
}

export interface DLsiteCategory {
  id: string
  name: string
}

export interface DLsiteGenre {
  name: string
}

export interface DLsiteTag {
  id: number
  name: string
}

export interface DLsiteDateTime {
  year: number | undefined
  month: number | undefined
  day: number | undefined
  hour: number | undefined
  minute: number | undefined
}

export interface DLsiteFavoriteItem {
  /** ID (e.g, RJ123456) */
  id: string
  /** アイテムのタイトル */
  title: string
  /** 説明文 */
  description: string
  /** アイテムへの URL */
  url: string
  /** サムネイルへの URL */
  thumbnailUrl: string
  /** 販売開始予定日時 (未発売の場合のみ) */
  startOfAvailable: DLsiteDateTime | undefined
  /** サークル名 */
  maker: DLsiteUser
  /** 作者 (声優) */
  author: DLsiteUser | undefined
  /** 定価 */
  initPrice: number
  /** 現在価格 */
  currPrice: number
  /** 割引終了日時 (割引中の場合のみ) */
  endOfDiscount: DLsiteDateTime | undefined
  /** 割引率 */
  discountRate: number
  /** 付与ポイント */
  point: number
  /** 評価数 (星) */
  starCount: number
  /** 評価レート */
  starRate: number
  /** レビュー数 */
  reviewCount: number
  /** 購入可能か */
  isCanPurchase: boolean
  /** カテゴリ */
  category: DLsiteCategory
  /** ジャンル */
  genres: DLsiteGenre[]
  /** タグ */
  tags: DLsiteTag[]
  /** フォルダ */
  folder: string
}

export default class DLsite {
  private readonly config: DLsiteConfig
  private page: Page | undefined
  public favorites: DLsiteFavoriteItem[] = []

  constructor(config: DLsiteConfig) {
    this.config = config
    this.initConfig()
    ;(async () => {
      const browser = await puppeteer.launch(config.puppeteerOptions)
      this.page = await browser.newPage()

      await this.login()
      this.favorites = await this.fetchFavorites()

      await browser.close()
    })()
  }

  private initConfig() {
    if (!this.config.cookiePath) {
      this.config.cookiePath = `cookies.json`
    }
    if (!this.config.isIgnoreCookie) {
      this.config.isIgnoreCookie = false
    }
  }

  private async login(isIgnoreCookie = false) {
    if (!this.config.cookiePath) {
      return
    }
    if (!isIgnoreCookie && fs.existsSync(this.config.cookiePath)) {
      const cookies = JSON.parse(
        fs.readFileSync(this.config.cookiePath, 'utf-8')
      )
      for (const cookie of cookies) {
        await this.page?.setCookie(cookie)
      }
    }
    await this.page?.goto('https://login.dlsite.com/login', {
      waitUntil: 'networkidle2',
    })
    if (
      !isIgnoreCookie &&
      this.page?.url() !== 'https://login.dlsite.com/login'
    ) {
      // login success?
      return
    }

    await this.page
      ?.waitForSelector('input#form_id', {
        visible: true,
      })
      .then((element) => element?.type(this.config.username))
    await this.page
      ?.waitForSelector('input#form_password', {
        visible: true,
      })
      .then((element) => element?.type(this.config.password))
    await this.page
      ?.waitForSelector('.loginBtn button', {
        visible: true,
      })
      .then((element) => element?.click())

    await this.page?.waitForTimeout(5000)
    if (this.page?.url() === 'https://login.dlsite.com/login') {
      throw new Error('Login failed')
    }
    const cookies = await this.page?.cookies()
    fs.writeFileSync(this.config.cookiePath, JSON.stringify(cookies))
  }

  private async fetchFavorites(): Promise<DLsiteFavoriteItem[]> {
    await this.page?.goto('https://www.dlsite.com/maniax/mypage/wishlist', {
      waitUntil: 'networkidle2',
    })

    await this.page
      ?.waitForSelector('table.n_worklist', {
        visible: true,
      })
      .catch((reason) => console.log(reason))

    const list = await this.page?.$('table.n_worklist')
    if (list == null) {
      throw new Error('Failed get favorites list.')
    }
    const trs = await list.$$('tr._favorite_item')
    const results: DLsiteFavoriteItem[] = []
    for (const tr of trs) {
      const url = (await tr.$eval('dt.work_name a', (elem) =>
        elem.getAttribute('href')
      )) as string
      const id = url?.match(/\/([A-Z0-9]+)\.html$/)?.[1] as string
      const title = (await tr.$eval('dt.work_name a', (elem) =>
        elem.textContent?.trim()
      )) as string
      const folder = (await tr.$eval('a._folder_name', (elem) =>
        elem.textContent?.trim()
      )) as string
      const endOfDiscountRaw = await tr.$eval('span.period_date', (elem) =>
        elem.textContent?.trim()
      )
      const endOfDiscount = endOfDiscountRaw
        ? this.parseDate(endOfDiscountRaw)
        : undefined
      const thumbnailUrl = (await tr.$eval('div.work_thumb a img', (elem) =>
        elem.getAttribute('src')
      )) as string
      const maker = (await tr.$eval('dd.maker_name a', (elem) =>
        elem.textContent?.trim()
      )) as string
      const makerLink = (await tr.$eval('dd.maker_name a', (elem) =>
        elem.getAttribute('href')
      )) as string
      const makerId = makerLink?.match(/\/([A-Z0-9]+)\.html$/)?.[1] as string
      const author = (await tr.$eval('dd.author a', (elem) =>
        elem.textContent?.trim()
      )) as string
      const authorLink = (await tr.$eval('dd.author a', (elem) =>
        elem.getAttribute('href')
      )) as string
      const authorId = authorLink?.match(/\/([A-Z0-9]+)\.html$/)?.[1] as string
      const initPrice = await tr.$eval('span.strike', (elem) =>
        Number(elem.textContent?.replace(',', ''))
      )
      const currPrice = await tr.$eval('span.work_price', (elem) =>
        Number(elem.textContent?.replace(',', ''))
      )
      const discountRate = await tr.$eval(
        'dd.work_price_wrap type_sale',
        (elem) => Number(elem.textContent?.replace('%OFF', ''))
      )
      const point = await tr.$eval(
        'dd.work_price_wrap span.work_point',
        (elem) =>
          Number(elem.textContent?.match(/([0-9]+)pt/)?.[1].replace(',', ''))
      )
      const description = (await tr.$eval('dd.work_text', (elem) =>
        elem.textContent?.trim()
      )) as string
      const genres = await this.getGenres(tr)
      const tags = await this.getTags(tr)
      const category = (await tr.$eval('div.work_category', (elem) =>
        elem.textContent?.trim()
      )) as string
      const categoryUrl = (await tr.$eval('div.work_category a', (elem) =>
        elem.getAttribute('href')
      )) as string
      const categoryId = categoryUrl?.match(/\/([A-Z0-9]+)$/)?.[1] as string
      const starCount = await tr.$eval('li.work_rating', (elem) =>
        Number(elem.textContent?.replace(',', ''))
      )
      const starRate = await this.getStarRate(tr)
      const reviewCount = await tr.$eval('li.work_to_review', (elem) =>
        Number(elem.textContent?.replace(',', ''))
      )
      const startOfAvailableRaw = await tr.$eval(
        'dt.work_name p.expected_date',
        (elem) => elem.textContent?.trim()
      )
      const startOfAvailable = startOfAvailableRaw
        ? this.parseDate(startOfAvailableRaw)
        : undefined
      const isCanPurchase = !!(await tr.$('a.btn_cart'))

      const objMaker: DLsiteUser = {
        id: makerId,
        name: maker,
        link: makerLink,
      }
      const objAuthor: DLsiteUser | undefined = author
        ? {
            id: authorId,
            name: author,
            link: authorLink,
          }
        : undefined
      const objCategory: DLsiteCategory = {
        id: categoryId,
        name: category,
      }
      results.push({
        id,
        title,
        description,
        url,
        thumbnailUrl,
        startOfAvailable,
        maker: objMaker,
        author: objAuthor,
        initPrice,
        currPrice,
        endOfDiscount,
        discountRate,
        point,
        starCount,
        starRate,
        reviewCount,
        isCanPurchase,
        category: objCategory,
        genres,
        tags,
        folder,
      })
    }
    return results
  }

  private async getGenres(
    element: puppeteer.ElementHandle<Element>
  ): Promise<DLsiteGenre[]> {
    const workGenre = await element.$('dd.work_genre')
    if (workGenre == null) {
      return []
    }
    const genres = await workGenre.$$eval('span', (elems) =>
      elems.map((elem) => {
        return {
          name: elem.textContent?.trim() ?? '',
        }
      })
    )
    return genres
  }

  private async getTags(
    element: puppeteer.ElementHandle<Element>
  ): Promise<DLsiteTag[]> {
    const searchTag = await element.$('dd.search_tag')
    if (searchTag == null) {
      return []
    }
    const tags = await searchTag.$$eval('a', (elems) =>
      elems.map((elem) => {
        return {
          id: Number(elem.getAttribute('href')?.match(/\/([0-9]+)\//)?.[1]),
          name: elem.textContent?.trim() ?? '',
        }
      })
    )
    return tags
  }

  private async getStarRate(
    element: puppeteer.ElementHandle<Element>
  ): Promise<number> {
    // e.g, star_50
    return await element
      .$eval(
        'li.star_rating',
        (elem) => Number(elem.className.match(/star_(\d+)/)?.[1]) / 10
      )
      .catch(() => -1)
  }

  private parseDate(str: string): DLsiteDateTime {
    const year = str.match(/^(\d{4})年/)
      ? Number(str.match(/^(\d{4})年/)?.[1])
      : undefined
    const month = str.match(/^(\d{2})月/)
      ? Number(str.match(/^(\d{2})月/)?.[1])
      : undefined
    const day = str.match(/^(\d{2})日/)
      ? Number(str.match(/^(\d{2})日/)?.[1])
      : undefined
    const hour = str.match(/^(\d{2})時/)
      ? Number(str.match(/^(\d{2})時/)?.[1])
      : undefined
    const minute = str.match(/^(\d{2})分/)
      ? Number(str.match(/^(\d{2})分/)?.[1])
      : undefined
    return {
      year,
      month,
      day,
      hour,
      minute,
    }
  }
}
