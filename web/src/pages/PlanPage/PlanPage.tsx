import { ArrowLeft, ArrowRight, BedDouble, Clock3, MapPin, Route, Sparkles, Utensils, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Header, Footer } from '../../components/Common';
import styles from './PlanPage.module.css';

type LocalText = { zh: string; en: string };
type DayPlan = {
  title: LocalText;
  distance: LocalText;
  stay: LocalText;
  do: LocalText;
  eat: LocalText;
};
type RegionPlan = {
  slug: string;
  name: LocalText;
  title: LocalText;
  eyebrow: LocalText;
  summary: LocalText;
  note: LocalText;
  image: string;
  duration: LocalText;
  drive: LocalText;
  days: DayPlan[];
};

const IMAGES = {
  adelaide: 'https://assets.atdw-online.com.au/images/a413083a58fc524373c90042fa3d6f21.jpeg?fit=crop&w=1600&h=900&sharp=10',
  hills: 'https://assets.atdw-online.com.au/images/be1841acfaf8aba566e6c0930326a2d9.jpeg?fit=crop&w=1600&h=900&sharp=10',
  barossa: 'https://assets.atdw-online.com.au/images/f41b1d4d4a4b58b9cc9909c6df142509.jpeg?fit=crop&w=1600&h=900&sharp=10',
  island: 'https://assets.atdw-online.com.au/images/8fece3c3b536aa1c5fc89c2537b9823e.jpeg?fit=crop&w=1600&h=900&sharp=10',
  fleurieu: 'https://assets.atdw-online.com.au/images/ad5498e704591af223b1f1d4c78202ef.jpeg?fit=crop&w=1600&h=900&sharp=10',
  murray: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&h=900&fit=crop&auto=format',
  limestone: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&h=900&fit=crop&auto=format',
};

const tx = (zh: string, en: string): LocalText => ({ zh, en });

const REGIONS: RegionPlan[] = [
  {
    slug: 'adelaide', name: tx('阿德莱德', 'Adelaide'),
    title: tx('阿德莱德三日城市漫游', 'Three days in Adelaide'),
    eyebrow: tx('城市文化 · 海滩日落 · 市集美食', 'Culture · coast · market flavours'),
    summary: tx('在公园环抱的城市里，把中央市场的烟火气、北台地的文化馆藏、巷弄酒吧和西向海岸的落日，串成一段松弛而丰盛的城市假期。', 'Link together market mornings, North Terrace culture, laneway bars and glowing west-coast sunsets in Australia’s relaxed festival city.'),
    note: tx('市中心大多数景点可以步行抵达；前往格雷尔或亨利海滩可乘电车或短程驾车。节庆期间建议提前预订住宿与餐厅。', 'Most city sights are walkable. Use the tram or a short drive for the coast, and book early during festival season.'),
    image: IMAGES.adelaide, duration: tx('3 天', '3 days'), drive: tx('市区轻松漫游', 'Easy city touring'),
    days: [
      { title: tx('第一天 · 市场与城市脉搏', 'Day 1 · Markets and city rhythm'), distance: tx('步行约 4 公里', 'Around 4 km on foot'), stay: tx('入住中央商务区或东区，步行即可到达餐厅与文化街区。', 'Stay in the CBD or East End for easy access to dining and culture.'), do: tx('从阿德莱德中央市场开启早晨，沿维多利亚广场走到北台地，参观南澳美术馆、博物馆与植物园。', 'Start at Adelaide Central Market, then follow the city grid to North Terrace, its galleries, museum and Botanic Garden.'), eat: tx('在市场享用早餐，午后到国家葡萄酒中心品尝南澳佳酿，晚上探索 Peel Street 与 Leigh Street。', 'Breakfast at the market, taste South Australian wine in the afternoon, then explore Peel and Leigh Streets after dark.') },
      { title: tx('第二天 · 屋顶风景与海边落日', 'Day 2 · Rooftops and a beach sunset'), distance: tx('市区至海岸约 12 公里', 'About 12 km to the coast'), stay: tx('继续住在市中心，减少搬运行李，把时间留给城市。', 'Keep your city base and leave more time for exploring.'), do: tx('清晨漫步托伦斯河畔，登上阿德莱德椭圆球场屋顶；下午搭电车到格雷尔海滩，沿栈桥看日落。', 'Walk the River Torrens, climb Adelaide Oval, then ride the tram to Glenelg for a sunset by the jetty.'), eat: tx('在河岸喝咖啡，午餐选择市区小酒馆，傍晚在 Jetty Road 或海滨餐厅用餐。', 'Pause for riverside coffee, lunch at a city bistro and dine around Jetty Road or the foreshore.') },
      { title: tx('第三天 · 港口故事与慢生活', 'Day 3 · Port stories and slow living'), distance: tx('往返约 30 公里', 'Around 30 km return'), stay: tx('若次日离境，可选择机场或西区附近住宿。', 'For an early departure, consider an airport or western-suburbs stay.'), do: tx('前往阿德莱德港，乘船寻找海豚、划皮艇穿过红树林，或在海事博物馆了解港口历史。', 'Head to Port Adelaide for dolphin cruising, mangrove kayaking or maritime history.'), eat: tx('在 Semaphore 享用海边午餐，以当地海鲜、精酿啤酒和悠闲散步结束旅程。', 'Finish with seafood, local beer and an easy seaside walk at Semaphore.') },
    ],
  },
  {
    slug: 'adelaide-hills', name: tx('阿德莱德山', 'Adelaide Hills'),
    title: tx('阿德莱德山四日田园之旅', 'Four-day Adelaide Hills escape'),
    eyebrow: tx('凉爽气候葡萄酒 · 德式村庄 · 山林花园', 'Cool-climate wine · villages · gardens'),
    summary: tx('蜿蜒山路穿过果园、葡萄园和童话般的小镇。这里距离城市仅二十分钟，却有足够多的酒庄、农场和森林，让旅程慢下来。', 'Winding roads thread through orchards, vineyards and storybook villages, only twenty minutes from the city yet a world away.'),
    note: tx('可住在 Stirling 或 Hahndorf 连游四天，也可从阿德莱德把任意一天拆成一日游。秋季花园色彩最丰富。', 'Base yourself in Stirling or Hahndorf, or take each day as a separate trip from Adelaide. Gardens are especially vivid in autumn.'),
    image: IMAGES.hills, duration: tx('4 天', '4 days'), drive: tx('约 180 公里', 'About 180 km'),
    days: [
      { title: tx('第一天 · 阿德莱德至 Stirling', 'Day 1 · Adelaide to Stirling'), distance: tx('约 20 公里', 'About 20 km'), stay: tx('选择 Mount Lofty 一带的山林度假酒店，或入住 Stirling 精品旅宿。', 'Choose a forest retreat near Mount Lofty or a boutique stay in Stirling.'), do: tx('漫步洛夫蒂山植物园，登顶俯瞰平原，再沿 Piccadilly Valley 小型酒庄线路慢慢品鉴。', 'Walk Mount Lofty Botanic Garden, take in the summit view and follow the boutique wineries of Piccadilly Valley.'), eat: tx('在 Stirling 的季节餐厅用午餐，晚上寻找使用本地农产的精致小馆。', 'Lunch in Stirling and seek out a dinner shaped by local, seasonal produce.') },
      { title: tx('第二天 · Hahndorf 的村庄时光', 'Day 2 · Village time in Hahndorf'), distance: tx('约 18 公里', 'About 18 km'), stay: tx('住进主街历史旅馆，或选择镇外自然环抱的独立小屋。', 'Stay in a historic main-street hotel or a secluded cabin outside town.'), do: tx('参加村庄步行导览，逛手作店与画廊；夏季可到 Beerenberg 采摘草莓，再骑行穿过葡萄园。', 'Join a village walk, browse makers and galleries, pick summer strawberries and cycle between vineyards.'), eat: tx('品尝德式烘焙与山谷奶酪，再以本地啤酒、苹果酒或凉爽气候白葡萄酒佐餐。', 'Pair German-style baking and Hills cheese with local beer, cider or cool-climate white wine.') },
      { title: tx('第三天 · Woodside 至 Gumeracha', 'Day 3 · Woodside to Gumeracha'), distance: tx('约 45 公里', 'About 45 km'), stay: tx('入住历史磨坊改造旅宿，或葡萄园中的安静别墅。', 'Sleep in a converted historic mill or a quiet vineyard villa.'), do: tx('拜访手工奶酪工坊、Big Rocking Horse 和精品酒庄，从葡萄园近距离了解酿造过程。', 'Visit an artisan cheesery, the Big Rocking Horse and a boutique winery for a closer look at grape-to-glass craft.'), eat: tx('在酒庄花园享用长午餐，傍晚转往小型蒸馏厂或乡村精酿酒吧。', 'Settle in for a winery lunch, then discover a small distillery or country brewery.') },
      { title: tx('第四天 · 峡谷野生动物与返程', 'Day 4 · Wildlife and the scenic return'), distance: tx('约 55 公里', 'About 55 km'), stay: tx('当天返回阿德莱德，无需额外住宿。', 'Return to Adelaide; no extra overnight stay needed.'), do: tx('在 Gorge Wildlife Park 近距离观察考拉与袋鼠，沿 Torrens Valley Scenic Drive 悠闲返程。', 'Meet koalas and kangaroos at Gorge Wildlife Park and return via the Torrens Valley Scenic Drive.'), eat: tx('在梨园品尝果酒与柴火披萨，或到历史宅邸花园享用一顿从农场到餐桌的午餐。', 'Taste pear cider and wood-fired pizza, or enjoy a garden-to-table lunch in a historic homestead.') },
    ],
  },
  {
    slug: 'barossa', name: tx('芭罗莎谷', 'Barossa Valley'),
    title: tx('芭罗莎谷四日慢享之旅', 'Four slow days in the Barossa'),
    eyebrow: tx('老藤设拉子 · 乡村餐桌 · 百年酒庄', 'Old-vine shiraz · country tables · heritage estates'),
    summary: tx('芭罗莎的生活围绕种植、酿造与分享展开。从 Lyndoch 到 Tanunda、Angaston 和 Nuriootpa，葡萄藤、面包房和餐桌讲述着近两百年的移民与土地故事。', 'Life in the Barossa is rooted in growing, making and sharing, with almost two centuries of stories carried through vines, bakeries and generous tables.'),
    note: tx('Tanunda、Angaston 与 Nuriootpa 彼此距离很近；路线可缩短、调换顺序或反向进行。品酒后请安排代驾或参加小团。', 'The three main towns sit within easy driving distance. Shorten or reverse the route, and arrange a driver or tour when tasting.'),
    image: IMAGES.barossa, duration: tx('4 天', '4 days'), drive: tx('约 210 公里', 'About 210 km'),
    days: [
      { title: tx('第一天 · 经 Lyndoch 抵达 Tanunda', 'Day 1 · Adelaide to Tanunda via Lyndoch'), distance: tx('约 80 公里', 'About 80 km'), stay: tx('入住葡萄园中的历史小屋，寻找带酒窖、壁炉或小型泳池的房型。', 'Choose a historic vineyard cottage, perhaps with a cellar, fireplace or plunge pool.'), do: tx('沿酒庄与奶酪工坊缓慢前行，走进历史庄园，认识老藤设拉子和家族酿酒传统。', 'Move slowly between cellar doors, cheesemakers and historic estates to meet old-vine shiraz and family winemaking traditions.'), eat: tx('从乡村面包房开始，在酒庄制作自己的奶酪拼盘，晚餐选择 Tanunda 的季节餐厅。', 'Begin at a country bakery, build a local cheese board and dine seasonally in Tanunda.') },
      { title: tx('第二天 · Tanunda 至 Angaston', 'Day 2 · Tanunda to Angaston'), distance: tx('约 15 公里', 'About 15 km'), stay: tx('住进 Angaston 的历史建筑或宁静庄园。', 'Stay in a heritage property or quiet estate around Angaston.'), do: tx('逛 Barossa Farmers Market，参观桶匠工坊与酒庄花园，沿小镇主街寻找本地手作。', 'Browse the farmers market, see cooperage craft, wander winery gardens and discover local makers.'), eat: tx('以丰盛早午餐开场，午后品尝设拉子与歌海娜，晚上在小型餐厅分享当季菜肴。', 'Start with a generous brunch, taste shiraz and grenache, then share seasonal plates at an intimate restaurant.') },
      { title: tx('第三天 · Nuriootpa 与 Seppeltsfield', 'Day 3 · Nuriootpa and Seppeltsfield'), distance: tx('约 35 公里', 'About 35 km'), stay: tx('选择酒庄住宿，给傍晚留出在葡萄园散步的时间。', 'Choose a winery stay and leave time for an evening vineyard walk.'), do: tx('沿棕榈大道抵达 Seppeltsfield，参加百年年份酒体验，并到小型酒窖与酿酒师交流。', 'Follow the palm-lined road to Seppeltsfield for historic fortified wine and conversations in smaller cellar doors.'), eat: tx('把午餐交给酒庄餐厅，傍晚以本地食材、炭火料理和一杯年份酒收尾。', 'Let a winery restaurant host lunch, then finish with local produce, fire cooking and a rare vintage pour.') },
      { title: tx('第四天 · Eden Valley 与返程', 'Day 4 · Eden Valley and return'), distance: tx('约 80 公里', 'About 80 km'), stay: tx('返回阿德莱德，或在山谷多住一晚。', 'Return to Adelaide or linger for another night.'), do: tx('转入海拔更高的 Eden Valley，欣赏观景台与凉爽气候葡萄园，再悠闲返回城市。', 'Climb into Eden Valley for lookouts and cool-climate vineyards before an unhurried return.'), eat: tx('带上面包、奶酪与果酱作为旅途纪念，在返程前享用最后一顿乡村午餐。', 'Take home bread, cheese and preserves after one last country lunch.') },
    ],
  },
  {
    slug: 'kangaroo-island', name: tx('袋鼠岛', 'Kangaroo Island'),
    title: tx('袋鼠岛三日荒野公路之旅', 'Three-day Kangaroo Island wilderness drive'),
    eyebrow: tx('野生动物 · 原始海岸 · 岛屿风味', 'Wildlife · raw coastline · island produce'),
    summary: tx('沿着岛屿公路驶入野生动物的家园，在风雕岩石、洁白海滩和桉树林之间，找回由自然决定节奏的旅行。', 'Follow island roads through wildlife habitat, white beaches, eucalyptus woodland and wind-sculpted coast.'),
    note: tx('轮渡车辆名额旺季紧张，请提早预订；岛上距离比地图看起来更远，避免夜间驾驶并随时留意野生动物。', 'Book ferry vehicle space early, allow more driving time than the map suggests, and avoid driving after dark when wildlife is active.'),
    image: IMAGES.island, duration: tx('3 天', '3 days'), drive: tx('约 450 公里', 'About 450 km'),
    days: [
      { title: tx('第一天 · Penneshaw 至 Kingscote', 'Day 1 · Penneshaw to Kingscote'), distance: tx('约 65 公里', 'About 65 km'), stay: tx('入住 Kingscote 海滨旅馆，或选择 Brown Beach 的独立度假屋。', 'Stay on the Kingscote waterfront or choose a private retreat near Brown Beach.'), do: tx('下船后前往海豹湾参加导览，沿南岸停靠 Pennington Bay，并在黄昏观察岛上野生动物。', 'After the ferry, join a guided Seal Bay walk, pause at Pennington Bay and watch island wildlife around dusk.'), eat: tx('品尝岛上蜂蜜、奶酪、杜松子酒与当日海鲜，把本地产物组合成第一顿岛屿晚餐。', 'Build your first island meal around local honey, cheese, gin and fresh seafood.') },
      { title: tx('第二天 · Flinders Chase 国家公园', 'Day 2 · Flinders Chase National Park'), distance: tx('约 220 公里往返', 'About 220 km return'), stay: tx('住在岛西生态小屋，或返回 Kingscote。', 'Stay in a western eco-retreat or return to Kingscote.'), do: tx('预留整天探索 Remarkable Rocks、Admirals Arch 与崎岖步道，在专业向导陪同下理解火后生态。', 'Give a full day to Remarkable Rocks, Admirals Arch and rugged trails, ideally with a guide who can interpret the recovering landscape.'), eat: tx('准备野餐与饮水；晚上回到旅宿享用以岛上农产为主的简单晚餐。', 'Carry a picnic and water, then return for a relaxed dinner shaped by island produce.') },
      { title: tx('第三天 · 北岸海滩与返程', 'Day 3 · North-coast beaches and return'), distance: tx('约 165 公里', 'About 165 km'), stay: tx('按轮渡时间返程，或在 Penneshaw 多住一晚。', 'Return with your ferry or linger overnight in Penneshaw.'), do: tx('前往 Emu Bay 或 Stokes Bay，在隐蔽岩道后发现清澈海湾，再到野生动物园近距离观察考拉。', 'Seek out Emu Bay or the hidden entrance to Stokes Bay, then meet koalas at a wildlife park.'), eat: tx('在 Kingscote 或 Penneshaw 享用海边午餐，采购蜂蜜与岛屿酒款后登船。', 'Have a seaside lunch in Kingscote or Penneshaw and take home island honey or spirits.') },
    ],
  },
  {
    slug: 'fleurieu', name: tx('菲尔半岛', 'Fleurieu Peninsula'),
    title: tx('菲尔半岛三日山海之旅', 'Three days around the Fleurieu Peninsula'),
    eyebrow: tx('McLaren Vale · 海岸公路 · 海鲜小镇', 'McLaren Vale · coast roads · seafood towns'),
    summary: tx('从葡萄园一路驶向南大洋，把 McLaren Vale 的餐桌、Victor Harbor 的海风和半岛南端的开阔景色放进同一段周末。', 'Drive from vineyard tables to Southern Ocean air, combining McLaren Vale, Victor Harbor and the peninsula’s open southern edge.'),
    note: tx('海岸天气变化快，请携带防风衣；冬季有机会从岸边观察迁徙鲸群。', 'Coastal weather changes quickly, so carry a windproof layer. In winter, watch for migrating whales from shore.'),
    image: IMAGES.fleurieu, duration: tx('3 天', '3 days'), drive: tx('约 280 公里', 'About 280 km'),
    days: [
      { title: tx('第一天 · 阿德莱德至 McLaren Vale', 'Day 1 · Adelaide to McLaren Vale'), distance: tx('约 45 公里', 'About 45 km'), stay: tx('入住葡萄园旅宿或 Willunga 历史小屋。', 'Stay among the vines or in a heritage Willunga cottage.'), do: tx('在艺术酒庄、精品酒窖与橄榄园间穿行，登上丘陵观景点远望海岸。', 'Move between art-filled wineries, small cellar doors and olive groves, with a hilltop view towards the coast.'), eat: tx('选择一顿长午餐，品尝当地歌海娜、设拉子、橄榄油与农场蔬果。', 'Choose a long lunch of local grenache, shiraz, olive oil and farm produce.') },
      { title: tx('第二天 · Victor Harbor 与 Port Elliot', 'Day 2 · Victor Harbor and Port Elliot'), distance: tx('约 55 公里', 'About 55 km'), stay: tx('住在 Victor Harbor 海滨或 Port Elliot 精品旅店。', 'Stay on the Victor Harbor waterfront or in boutique Port Elliot.'), do: tx('沿堤道前往 Granite Island，搭乘历史电车或徒步海岸；冬季到观景台寻找鲸群。', 'Cross to Granite Island, ride the heritage tram or follow the coast walk, watching for whales in winter.'), eat: tx('在 Port Elliot 寻找经典烘焙与海鲜，傍晚到 Horseshoe Bay 看海。', 'Seek out classic bakery treats and seafood in Port Elliot, ending by Horseshoe Bay.') },
      { title: tx('第三天 · 半岛南端与返程', 'Day 3 · The southern peninsula and return'), distance: tx('约 180 公里', 'About 180 km'), stay: tx('当天返回阿德莱德。', 'Return to Adelaide today.'), do: tx('向 Cape Jervis 前进，绕行 Second Valley 的清澈海湾，再沿海岸与乡村道路返回。', 'Continue towards Cape Jervis, detour to the clear water at Second Valley, then return through coast and country.'), eat: tx('用当地鱼获与乡村咖啡馆串起返程，在酒庄采购最后一瓶半岛风味。', 'Link the return with local fish, a country café and one final bottle from the peninsula.') },
    ],
  },
  {
    slug: 'murray', name: tx('墨累河', 'Murray River'),
    title: tx('墨累河三日水岸慢游', 'Three slow days on the Murray River'),
    eyebrow: tx('河轮 · 湿地 · 河畔小镇', 'Paddle steamers · wetlands · river towns'),
    summary: tx('跟随澳大利亚最长河流的弯曲水道，在红色峭壁、桉树林与湿地之间，把时间交给水面。', 'Follow Australia’s longest river through red cliffs, river red gums and wetlands, letting the water set the pace.'),
    note: tx('夏季炎热，请避开正午户外活动并携带充足饮水；水上项目与河轮班次建议提前确认。', 'Summers are hot: avoid exposed midday activity, carry water and confirm cruise or watersport schedules ahead.'),
    image: IMAGES.murray, duration: tx('3 天', '3 days'), drive: tx('约 330 公里', 'About 330 km'),
    days: [
      { title: tx('第一天 · Mannum 的河轮记忆', 'Day 1 · Paddle-steamer history in Mannum'), distance: tx('约 85 公里', 'About 85 km'), stay: tx('入住河景旅馆、船屋或营地小屋。', 'Choose a river-view hotel, houseboat or cabin.'), do: tx('参观河轮历史中心，登船巡航红崖与桉树林，日落时沿河岸散步。', 'Visit the paddle-steamer museum, cruise beneath red cliffs and river gums, then walk the bank at sunset.'), eat: tx('在历史街区享用午餐，以河畔烧烤或乡村餐厅结束一天。', 'Lunch in the historic township and finish with a riverside barbecue or country dining room.') },
      { title: tx('第二天 · Murray Bridge 与 Monarto', 'Day 2 · Murray Bridge and Monarto'), distance: tx('约 70 公里', 'About 70 km'), stay: tx('住在 Murray Bridge 水岸，便于清晨出发。', 'Stay by the water in Murray Bridge for an easy start.'), do: tx('清晨划皮艇观察鸟类，随后前往 Monarto Safari Park，在广阔保护区体验野生动物导览。', 'Kayak at first light for birdlife, then join a wildlife experience across the open landscapes of Monarto Safari Park.'), eat: tx('准备本地野餐，傍晚回到河边寻找使用区域农产的餐馆。', 'Pack a local picnic and return to the river for a dinner using regional produce.') },
      { title: tx('第三天 · Coorong 湿地与返程', 'Day 3 · Coorong wetlands and return'), distance: tx('约 175 公里', 'About 175 km'), stay: tx('当天返回阿德莱德。', 'Return to Adelaide today.'), do: tx('驶向 Murray Mouth 与 Coorong，参加原住民文化或生态导览，认识沙丘、潟湖与候鸟栖息地。', 'Continue to the Murray Mouth and Coorong for Aboriginal cultural or ecological insight into dunes, lagoons and migratory birds.'), eat: tx('品尝 Coorong 鲻鱼与区域食材，在湖岸小镇用午餐为旅程收尾。', 'Taste Coorong mullet and regional produce over lunch in a lakeside town.') },
    ],
  },
  {
    slug: 'limestone-coast', name: tx('石灰岩海岸', 'Limestone Coast'),
    title: tx('石灰岩海岸四日奇境公路', 'Four-day Limestone Coast road trip'),
    eyebrow: tx('蓝湖 · 洞穴 · Coonawarra 红酒', 'Blue Lake · caves · Coonawarra reds'),
    summary: tx('沿南澳东南角展开一段地质与风味之旅：火山湖、地下洞穴、漫长沙滩，以及生长在红色土壤中的赤霞珠。', 'Explore South Australia’s southeast through volcanic lakes, underground caves, long beaches and cabernet grown in vivid terra rossa soil.'),
    note: tx('从阿德莱德单程约四至五小时，适合自驾并至少安排三晚。洞穴导览与季节性活动需提前预订。', 'Allow four to five hours from Adelaide and at least three nights. Book cave tours and seasonal experiences ahead.'),
    image: IMAGES.limestone, duration: tx('4 天', '4 days'), drive: tx('约 950 公里', 'About 950 km'),
    days: [
      { title: tx('第一天 · 经 Robe 抵达海岸', 'Day 1 · Coastbound via Robe'), distance: tx('约 335 公里', 'About 335 km'), stay: tx('入住 Robe 历史旅馆或海边小屋。', 'Stay in a heritage inn or beach house in Robe.'), do: tx('沿 Coorong 南下，在 Robe 的长滩、灯塔与历史街区间散步。', 'Travel south beside the Coorong and explore Robe’s long beach, lighthouse and historic streets.'), eat: tx('寻找岩龙虾与当日海鲜，搭配东南海岸的清爽白葡萄酒。', 'Look for rock lobster and the day’s seafood with a crisp regional white wine.') },
      { title: tx('第二天 · Coonawarra 的红色土壤', 'Day 2 · Coonawarra terra rossa'), distance: tx('约 150 公里', 'About 150 km'), stay: tx('住在 Penola 或葡萄园乡间旅宿。', 'Stay in Penola or a vineyard retreat.'), do: tx('沿窄长葡萄酒带拜访历史酒庄，认识红色土壤与赤霞珠的关系，再逛 Penola 文化街区。', 'Follow the narrow wine strip through historic estates, learning how terra rossa shapes cabernet, then explore Penola.'), eat: tx('在酒庄享用产区午餐，晚餐选择以牧场肉类与时令农产为主的小馆。', 'Lunch at a winery and dine on pastoral produce in town.') },
      { title: tx('第三天 · Naracoorte 洞穴', 'Day 3 · Naracoorte Caves'), distance: tx('约 60 公里', 'About 60 km'), stay: tx('继续住在 Penola，或前往 Mount Gambier。', 'Remain in Penola or continue to Mount Gambier.'), do: tx('进入世界遗产洞穴，观看古生物化石层与地下空间；傍晚漫步 Bool Lagoon 湿地。', 'Enter World Heritage caves to see fossil deposits and subterranean chambers, then walk the Bool Lagoon wetlands.'), eat: tx('在 Naracoorte 乡村咖啡馆停留，采购奶酪、蜂蜜与葡萄酒作为公路补给。', 'Pause at a Naracoorte café and stock up on cheese, honey and wine for the road.') },
      { title: tx('第四天 · Mount Gambier 蓝与绿', 'Day 4 · Mount Gambier in blue and green'), distance: tx('约 435 公里返程', 'About 435 km return'), stay: tx('可在 Mount Gambier 多住一晚，或分段返回阿德莱德。', 'Add a Mount Gambier night or split the return to Adelaide.'), do: tx('环行 Blue Lake，走入 Umpherston Sinkhole 的下沉花园，再探访清澈的 Piccaninnie Ponds。', 'Circle Blue Lake, descend into Umpherston Sinkhole garden and seek out the clear water of Piccaninnie Ponds.'), eat: tx('以当地咖啡与丰盛早午餐开始长途返程，途中在海岸小镇休息。', 'Fuel the long return with local coffee and brunch, pausing in coastal towns along the way.') },
    ],
  },
];

interface PlanPageProps {
  regionSlug?: string;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
}

export default function PlanPage({ regionSlug, onLoginClick, onRegisterClick, onNavClick }: PlanPageProps) {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language?.startsWith('zh') ? 'zh' : 'en';
  const text = (value: LocalText) => value[lang];
  const selected = REGIONS.find((region) => region.slug === regionSlug);

  if (regionSlug && !selected) {
    return (
      <div className={styles.page}>
        <Header onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onNavClick={onNavClick} />
        <main className={styles.notFound}>
          <span>404</span>
          <h1>{lang === 'zh' ? '暂未找到这个区域的行程' : 'This regional itinerary is not available yet'}</h1>
          <button data-testid="itinerary-back" onClick={() => onNavClick?.('/plan')}><ArrowLeft size={18} />{lang === 'zh' ? '返回全部行程' : 'Back to all itineraries'}</button>
        </main>
        <Footer />
      </div>
    );
  }

  if (selected) {
    return (
      <div className={styles.page}>
        <Header onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onNavClick={onNavClick} />
        <main>
          <section className={styles.detailHero} style={{ backgroundImage: `url(${selected.image})` }}>
            <div className={styles.detailShade} />
            <div className={styles.detailHeroContent}>
              <button className={styles.backButton} data-testid="itinerary-back" onClick={() => onNavClick?.('/plan')}><ArrowLeft size={18} />{lang === 'zh' ? '所有区域行程' : 'All regional itineraries'}</button>
              <p>{text(selected.eyebrow)}</p>
              <h1>{text(selected.title)}</h1>
              <div className={styles.tripFacts}>
                <span><Clock3 size={18} />{text(selected.duration)}</span>
                <span><Route size={18} />{text(selected.drive)}</span>
              </div>
            </div>
          </section>

          <section className={styles.storyIntro}>
            <div>
              <span className={styles.kicker}>{lang === 'zh' ? '区域行程指南' : 'Regional itinerary guide'}</span>
              <h2>{text(selected.name)}，值得慢慢走</h2>
            </div>
            <p>{text(selected.summary)}</p>
          </section>

          <aside className={styles.travelNote}>
            <Sparkles size={24} />
            <div><strong>{lang === 'zh' ? '旅行提示' : 'Travel note'}</strong><p>{text(selected.note)}</p></div>
          </aside>

          <section className={styles.timeline}>
            <header><span>{lang === 'zh' ? '路线安排' : 'The route'}</span><h2>{lang === 'zh' ? '把每天留给不同的风景' : 'A different landscape every day'}</h2></header>
            {selected.days.map((day, index) => (
              <article className={styles.day} key={day.title.en}>
                <div className={styles.dayIndex}><span>{String(index + 1).padStart(2, '0')}</span></div>
                <div className={styles.dayContent}>
                  <div className={styles.dayHeading}><div><small>{text(day.distance)}</small><h3>{text(day.title)}</h3></div><MapPin size={24} /></div>
                  <div className={styles.dayGrid}>
                    <section><BedDouble size={22} /><h4>{lang === 'zh' ? '住在哪里' : 'Where to stay'}</h4><p>{text(day.stay)}</p></section>
                    <section><Waves size={22} /><h4>{lang === 'zh' ? '看什么、玩什么' : 'What to see and do'}</h4><p>{text(day.do)}</p></section>
                    <section><Utensils size={22} /><h4>{lang === 'zh' ? '吃什么、喝什么' : 'Where to eat and drink'}</h4><p>{text(day.eat)}</p></section>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className={styles.productsCta}>
            <div><span>{lang === 'zh' ? '把灵感变成预订' : 'Turn ideas into bookings'}</span><h2>{lang === 'zh' ? `探索${text(selected.name)}的产品` : `Explore products in ${text(selected.name)}`}</h2></div>
            <button data-testid="itinerary-products" onClick={() => onNavClick?.(`/products?destination=${selected.slug}`)}>{lang === 'zh' ? '查看区域产品' : 'View regional products'}<ArrowRight size={18} /></button>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onNavClick={onNavClick} />
      <main>
        <section className={styles.landingHero}>
          <div className={styles.heroImage} />
          <div className={styles.heroCopy}>
            <span>{lang === 'zh' ? 'SOUTH AUSTRALIA · ITINERARIES' : 'SOUTH AUSTRALIA · ITINERARIES'}</span>
            <h1>{lang === 'zh' ? '旅程不是赶路，\n而是靠近南澳。' : 'Travel slowly.\nGet closer to South Australia.'}</h1>
            <p>{lang === 'zh' ? '追一场海边日落，在葡萄园里度过午后，或沿古老山脉驶向满天星光。我们已经把南澳各区域最值得体验的风景、餐桌与停留方式整理成路线。' : 'Chase a coastal sunset, linger over lunch among vines or drive ancient ranges beneath a sky full of stars. Start with a route and make it your own.'}</p>
            <button data-testid="itinerary-explore" onClick={() => document.getElementById('regional-itineraries')?.scrollIntoView({ behavior: 'smooth' })}>{lang === 'zh' ? '选择一个区域' : 'Choose a region'}<ArrowRight size={19} /></button>
          </div>
        </section>

        <section className={styles.regions} id="regional-itineraries">
          <header className={styles.sectionHeader}>
            <div><span>{lang === 'zh' ? 'REGIONAL ITINERARIES' : 'REGIONAL ITINERARIES'}</span><h2>{lang === 'zh' ? '按区域探索南澳行程' : 'Explore itineraries by region'}</h2></div>
            <p>{lang === 'zh' ? '南澳不是一种风景，而是许多个截然不同的世界。选择一处，从已经整理好的路线开始。' : 'South Australia is many distinct worlds. Pick one and begin with a thoughtfully mapped route.'}</p>
          </header>

          <div className={styles.regionGrid}>
            {REGIONS.map((region, index) => (
              <button
                type="button"
                className={`${styles.regionCard} ${index === 0 || index === 3 ? styles.regionCardWide : ''}`}
                key={region.slug}
                data-testid={`itinerary-region-${region.slug}`}
                onClick={() => onNavClick?.(`/plan/${region.slug}`)}
              >
                <img src={region.image} alt="" />
                <span className={styles.cardShade} />
                <span className={styles.regionNumber}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.regionCopy}><small>{text(region.eyebrow)}</small><strong>{text(region.name)}</strong><em>{text(region.duration)} · {text(region.drive)}</em></span>
                <span className={styles.regionArrow}><ArrowRight size={22} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.closingStatement}>
          <MapPin size={26} />
          <p>{lang === 'zh' ? '路线提供方向，但真正的旅行发生在计划之外。为一间路过的面包房停车，为一个无名观景台多留十分钟，也为自己留一点改变主意的空间。' : 'A route gives direction, but the best travel often happens beyond the plan. Stop for the bakery, linger at the unnamed lookout and leave room to change your mind.'}</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
