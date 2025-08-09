const express = require("express");
const router = express.Router();
const scrape = require("../controllers/scrape");

router.route("/").get(scrape.scrapeEbay);
router.route("/detail/:id").get(scrape.scrapeEbayDetail);

module.exports = router;
