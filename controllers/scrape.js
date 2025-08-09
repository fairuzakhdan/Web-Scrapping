const puppeteer = require("puppeteer");

const scrapeEbay = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Parameter 'query' diperlukan" });
  }

  let browser;
  try {
    // Jalankan browser
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Buka halaman pencarian eBay
    const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
      query
    )}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2" });

    // Ambil data
    const products = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".s-item"))
        .map((item) => {
          const title = item.querySelector(".s-item__title")?.innerText || '-';
          const price = item.querySelector(".s-item__price")?.innerText || '-';
          const description =
            item.querySelector(".s-item__subtitle")?.innerText || '-';
          const link = item.querySelector(".s-item__link")?.href || '-';

          let id = null;
          if (link) {
            const match = link.match(/(\d{9,})/);
            id = match ? match[0] : '-';
          }

          return { id, title, price, description };
        })
        .filter((p) => p.title);
    });

    res.json({
      status: "success",
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
};
const scrapeEbayDetail = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: "Parameter 'id' diperlukan" });
  }

  const url = `https://www.ebay.com/itm/${id}`;
  let browser;

  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    // Tunggu elemen penting muncul
    await page
      .waitForSelector("h1, #itemTitle", { timeout: 10000 })
      .catch(() => {});

    // Ambil data utama
    const data = await page.evaluate(() => {
      const safeText = (selector) =>
        document.querySelector(selector)?.innerText.trim() || null;
      const safeAttr = (selector, attr) =>
        document.querySelector(selector)?.getAttribute(attr) || null;

      return {
        title:
          safeText("#itemTitle") ||
          safeText("h1.x-item-title__mainTitle") ||
          '-',
        price:
          safeText("#prcIsum") ||
          safeText("#mm-saleDscPrc") ||
          safeText(".x-price-approx__price") ||
          safeText(".x-price-primary") ||
          '-',
        image:
          safeAttr("#icImg", "src") ||
          safeAttr(".ux-image-carousel-item img", "src") ||
          '-',

        iframeSrc: document.querySelector("#desc_ifr")?.src || '-',
        inlineDescription:
          safeText("#viTabs_0_is") || safeText(".d-item-description") || '-',
      };
    });

    let description = data.inlineDescription || "Deskripsi tidak ditemukan";

    // Kalau deskripsi di iframe, buka iframe di tab baru
    if (data.iframeSrc) {
      try {
        const iframePage = await browser.newPage();
        await iframePage.goto(data.iframeSrc, {
          waitUntil: "domcontentloaded",
        });
        description = await iframePage.evaluate(() =>
          document.body.innerText.trim()
        );
        await iframePage.close();
      } catch (err) {
        console.error("Gagal ambil deskripsi dari iframe:", err.message);
      }
    }

    res.json({
      status: "success",
      data: {
        id,
        link: url,
        title: data.title,
        price: data.price,
        image: data.image,
        description,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { scrapeEbay, scrapeEbayDetail };