# Gold Hunter — fast Cloudflare Cron Worker

## 为什么需要这个

你现有的新闻/Fed Rate 更新都是靠 **GitHub Actions** 的定时任务触发的。GitHub 官方声明 `schedule` 触发**不保证准时**，高峰期可能延迟。这个 Worker 跑在 **Cloudflare 自己的 Cron Triggers** 上，调度精度好得多，而且直接写入你现有的同一个 KV（`GH_MARKET_DATA`），不需要改动你网站的域名/DNS，也不影响现有 GitHub Actions 继续跑（两边同时存在，互为备份，谁的数据新就用谁的——这个逻辑已经写在 `functions/api/data-engine.js` 和 `functions/api/rate-expectation-engine.js` 里了）。

## 这个 Worker 具体做什么

1. **Fed Rate（重点解决你说的"一直不会自动连接官网"）**
   - 根本原因：CME FedWatch 官方 REST API 是**付费**产品（我已经查证，没有免费官方接口）；网页版 `cmegroup.com` 那个概率表格是前端 JS 渲染出来的，原始 HTML 里根本没有数据，所以之前用 `requests`/`curl` 硬抓网页的做法几乎注定抓不到东西——不是代码写错了，是这条路本身走不通。
   - 解决办法：改成**自己计算**。用免费、公开、不需要密钥的 30 天联邦基金期货结算价（Yahoo Finance 的 CBOT `ZQ` 合约报价，跟你现有 `quotes-engine.js` 用的是同一个免费接口），按 CME FedWatch 公开的计算方法（用期货价格反推市场隐含的会议后利率，再按25bp阶梯分配概率）自己算出结果。这样跟官方数字非常接近，但诚实地讲：**这是我们自己按官方方法算出来的，不是CME自己的数据流**，所以数据里会清楚标注 `Gold Hunter calculated (CME FedWatch methodology)`，不会冒充"官方直连"。
   - 每5分钟检查一次，但只在数据有实质变化（或超过15分钟没写过）时才真正写入KV `fed-rate-live-v1`——具体见下面"会不会把KV用完"那节。

2. **经济新闻（CPI/PPI/NFP/失业率/GDP/PCE等）**
   - 用 FRED 免费、不需要密钥的CSV下载接口（`fredgraph.csv`），逻辑跟你现有 `scripts/update_official_data.py` 里的 FRED 计算完全一致，作为比 GitHub Actions 更快的补充层。
   - 写入KV `official-live-snapshot-v1`；`data-engine.js` 已经有"哪个数据的统计周期更新就用哪个"的合并逻辑，所以这一步是纯增量、无风险的接入。

3. **ETF / 央行黄金储备没有放进这个高频 Worker**——因为 SPDR 官方本来就只在纽约收盘后公布一次，WGC/IMF的央行储备本来就是月度数据，官方源头本身没有更高频率可抓，加快轮询没有意义，继续交给现有 GitHub Actions workflow 即可。

## 会不会把 Cloudflare KV 免费额度用完？

**不会——但这是我在第一版里漏掉的东西，已经修好了。** Workers KV 免费额度是**每天1000次写入**（整个KV namespace共用，不是分key算的）。第一版代码是"每次跑都直接写"，如果按每2分钟一次、期货价格又几乎每次检查都有细微跳动，确实有可能把额度用爆，进而影响你网站其他所有依赖同一个KV的功能。

现在改成了跟你原来 `data-engine.js` 里同一套思路——**没有实质变化就不写**：
- Fed Rate：概率变动幅度小于1个百分点（比如61.2%变成61.4%这种期货报价的正常噪音）不算"实质变化"，不会触发写入。
- 经济数据：只要统计周期和数值字符串完全一样就不写（这类官方数据本来一个月才真的变一次，几乎不会有噪音问题）。
- 就算完全没变化，也会每15分钟强制刷新一次"最后检查时间"心跳，让Admin后台能看到这个Worker还活着，但不会更频繁地写。
- cron 频率也从每2分钟调整为**每5分钟**，你要的"分钟级"发布完全够用，同时进一步减少了总检查次数。

按这个设计，最坏情况大约是 `2个key × 每15分钟最多1次心跳写 × 24小时 = 192次/天`，再加上真正数据变化时的额外写入，全天总数远低于1000次的免费额度，给你网站其他KV使用（Admin保存、报价缓存等）留足空间。

如果之后还是不放心，可以在 `wrangler.toml` 里把 `*/5 * * * *` 改成 `*/10 * * * *` 甚至更保守，改完重新 `wrangler deploy` 一次就行；或者升级到 Cloudflare Workers Paid Plan（$5/月）直接取消这个每日写入次数限制。

## 部署步骤

1. 安装 wrangler（如果还没有）：
   ```
   npm i -g wrangler
   wrangler login
   ```
2. 打开 `wrangler.toml`，把 `<YOUR_KV_NAMESPACE_ID>` 换成你 Cloudflare Pages 项目里已经绑定的 `GH_MARKET_DATA` 那个 KV namespace 的 ID（在 Cloudflare Dashboard → Workers & Pages → KV 里能看到，或者跑 `wrangler kv namespace list`）。
3. 在这个文件夹里跑：
   ```
   wrangler deploy
   ```
4. 部署后，浏览器直接打开这个 Worker 的 URL（部署完成后 wrangler 会打印出来，类似 `https://gold-hunter-fast-cron.<你的子域>.workers.dev`），可以立刻手动触发一次并看到JSON结果，不用等第一次定时任务。
5. 不需要配置任何密钥——这里用到的数据源全部免费、不需要注册。

## 如何确认它生效了

- 打开 `/admin`，Fed Rate 卡片的 "Effective source" 字段以后应该会出现 `cloudflare-cron-calculated`（说明这个 Worker 在起作用），而不是一直卡在 `verified-static-fallback`。
- 如果想加快/减慢频率，改 `wrangler.toml` 里 `crons` 那一行（比如 `*/1 * * * *` 更快，或 `*/5 * * * *` 更省资源），改完重新 `wrangler deploy` 一次就生效。
