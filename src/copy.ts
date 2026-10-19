// All user-facing Thai text lives here so copy can be polished in one place (day 6).
// Rules (CLAUDE.md §2): never say "ปลอดภัย"; station numbers are station readings, not the house;
// always point to DDPM 1784.

export const DDPM = {
  hotline: "1784",
  telHref: "tel:1784",
  lineId: "@1784DDPM",
  lineHref: "https://line.me/R/ti/p/%401784DDPM",
};

export const copy = {
  appName: "น้ำมา",
  appNameEn: "NamMa",

  nav: {
    home: "หน้าแรก",
    chat: "แชท",
    map: "แผนที่สถานี",
    flood: "น้ำท่วม",
  },

  // Header light/dark button: the label names the current mode; pressing moves to the next.
  theme: {
    auto: "ธีม: ตามเครื่อง",
    light: "ธีม: สว่าง",
    dark: "ธีม: มืด",
    hint: "กดเพื่อเปลี่ยน",
  },

  line: {
    addFriend: "เพิ่มเพื่อนใน LINE",
    shareToFamily: "ส่งต่อให้ครอบครัวใน LINE",
  },

  home: {
    title: "น้ำจะถึงบ้านคุณไหม",
    subtitle: "บอกเราว่าบ้านคุณหรือบ้านพ่อแม่อยู่ที่ไหน เราจะดูสถานีวัดน้ำที่ใกล้ที่สุด แล้วบอกว่าควรทำอะไรตอนนี้",
    composerLabel: "ถามเรื่องน้ำ หรือบอกที่อยู่บ้าน",
    placeholder: "เช่น บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม",
    riverTitle: "แม่น้ำตอนนี้",
    riverSubtitle: "ระดับน้ำของแต่ละสถานี เทียบกับตลิ่งของสถานีนั้น เรียงจากต้นน้ำลงมา",
    seeMap: "ดูแผนที่สถานี",
    nowTitle: "สถานการณ์น้ำตอนนี้",
    tabs: { flood: "น้ำท่วม", river: "แม่น้ำ" },
    tabsLabel: "มุมมอง",
    seeFlood: "เปิดแผนที่น้ำท่วมเต็มจอ",
    scrollHint: "เลื่อนไปทางขวาเพื่อดูสถานีอื่น",
    stepsTitle: "เริ่มใช้ได้ในแชทแรก",
    steps: [
      { title: "บอกที่ตั้งบ้าน", text: "พิมพ์ชื่ออำเภอหรือส่งตำแหน่ง เราจะหาสถานีวัดน้ำที่ใกล้บ้านที่สุด" },
      {
        title: "บอกว่าใครอยู่บ้าง",
        text: "ถ้ามีผู้สูงอายุหรือผู้ป่วยติดเตียง เราจะเตือนให้เร็วขึ้น จำเมื่อคุณอนุญาตเท่านั้น และลบได้ทุกเมื่อ",
      },
      {
        title: "รับแจ้งเตือนทาง LINE",
        text: "เมื่อน้ำใกล้บ้านถึงระดับเสี่ยง เราจะส่งข้อความพร้อมสิ่งที่ควรทำและศูนย์พักพิงที่ใกล้ที่สุด",
      },
    ],
    footerLead: "น้ำเข้าบ้านแล้ว หรือติดอยู่? สายด่วน ปภ.",
  },

  river: {
    axisOver1: "ล้นตลิ่ง 1 ม.",
    axisBank: "ระดับตลิ่ง",
    axisBelow2: "ต่ำกว่าตลิ่ง 2 ม.",
    axisBelow4: "ต่ำกว่าตลิ่ง 4 ม.",
    main: "แม่น้ำเจ้าพระยา",
    sourceLead: "ที่มา: กรมชลประทาน และ สสน. ผ่าน ThaiWater",
    estimated: "ระดับเสี่ยงประเมินโดยน้ำมา จากระดับตลิ่งและสถานีต้นน้ำ",
    empty: "ยังไม่มีข้อมูลระดับน้ำ",
    // Home chart switcher: three drawings of the same readings.
    views: { label: "แสดงเป็น", staff: "เกจวัดน้ำ", line: "แนวลำน้ำ", sections: "ภาพตัดขวาง" },
    landSide: "ริมน้ำ · บ้านเรือน",
    bank: "ตลิ่ง",
    fromTo: (from: string, to: string) => `ต้นน้ำ ${from} → ปลายน้ำ ${to}`,
    upstreamFirst: "เรียงจากต้นน้ำ",
    othersNormal: (n: number) => `อีก ${n} สถานีปกติ`,
    allNormal: (n: number) => `ทุกสถานีปกติ (${n} สถานี)`,
    sectionsKey: {
      lead: "ภาพตัดขวางแม่น้ำที่แต่ละสถานี",
      land: "สีเทา",
      landIs: "คือตลิ่ง",
      water: "สีฟ้า",
      waterIs: "คือน้ำตอนนี้",
      over: "ถ้าน้ำสูงกว่าตลิ่ง จะเห็นน้ำล้นออกไปด้านข้าง",
    },
    notes: {
      line: "ภาพเทียบระดับน้ำกับตลิ่งของแต่ละสถานี ไม่ใช่ความลึกจริง",
      sections: "ภาพเทียบระดับน้ำกับตลิ่ง ไม่ใช่รูปร่างลำน้ำจริง",
    },
  },

  composer: {
    location: "ใช้ตำแหน่งของฉัน",
    voice: "พูดแทนการพิมพ์",
    listening: "กำลังฟัง… พูดได้เลยค่ะ",
    voiceFailed: "ฟังไม่ได้ ลองพิมพ์แทนนะคะ",
    send: "ส่ง",
  },

  account: {
    nav: "บัญชี",
    signIn: "เข้าสู่ระบบ",
    title: "บัญชีของฉัน",
    signInTitle: "เข้าสู่ระบบเพื่อให้น้ำมาจำข้อมูลไว้",
    signInBody:
      "บัญชีช่วยให้สถานที่ที่บันทึกไว้และข้อมูลครอบครัวอยู่กับคุณทุกเครื่อง สิ่งที่คุยไว้ในแชทก่อนเข้าสู่ระบบจะถูกเก็บเข้าบัญชีด้วย",
    lineSoon: "เข้าสู่ระบบด้วย LINE (เร็วๆ นี้)",
    googleMissing: "ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Google",
    demo: "เข้าสู่ระบบแบบทดลอง",
    demoName: "ชื่อบัญชีทดลอง (ภาษาอังกฤษ)",
    merged: "เก็บสิ่งที่คุยไว้ในแชทเข้าบัญชีแล้วค่ะ",
    signedInAs: "เข้าสู่ระบบเป็น",
    ways: "วิธีเข้าสู่ระบบ",
    line: "LINE",
    google: "Google",
    linked: "เชื่อมแล้ว",
    notLinked: "ยังไม่ได้เชื่อม",
    linkGoogle: "เชื่อมบัญชี Google",
    unlink: "เลิกเชื่อม",
    lineNote: "เชื่อม LINE เพื่อรับแจ้งเตือนเมื่อน้ำใกล้บ้านสูงขึ้น",
    logout: "ออกจากระบบ",
    deleteTitle: "ลบบัญชี",
    deleteBody:
      "ลบบัญชี สถานที่ ข้อมูลครอบครัว ความยินยอม และประวัติแชททั้งหมด กู้คืนไม่ได้",
    deleteAsk: "ลบบัญชี",
    deleteConfirm: "ยืนยัน ลบบัญชีถาวร",
    cancel: "ยกเลิก",
    failed: "ทำรายการไม่สำเร็จ ลองอีกครั้งค่ะ",
    conflict: "บัญชีนี้เชื่อมกับบัญชีอื่นของผู้ให้บริการนี้อยู่แล้ว",
    lastWay: "เลิกเชื่อมไม่ได้ เพราะเป็นวิธีเข้าสู่ระบบเดียวของบัญชีนี้",
  },

  profile: {
    title: "ข้อมูลที่จำไว้",
    subtitle: "น้ำมาจำเฉพาะสิ่งที่คุณบอก ลบได้ทุกเมื่อ",
    steps: { place: "ที่ตั้ง", household: "คนในบ้าน", consent: "ยินยอม", line: "LINE" },
    done: "เสร็จแล้ว",
    places: "สถานที่ของฉัน",
    placesEmpty: "บอกที่ตั้งบ้านในแชท เช่น “บ้านแม่อยู่บางบาล” แล้วเราจะดูสถานีวัดน้ำที่ใกล้ที่สุดให้",
    approx: "ตำแหน่งประมาณจากชื่อพื้นที่",
    nearest: "สถานีใกล้สุด",
    away: "ห่าง",
    household: "คนในบ้าน",
    householdEmpty: "ยังไม่ได้บอกว่าใครอยู่บ้าง เช่น ผู้สูงอายุ ผู้ป่วยติดเตียง เด็กเล็ก หรือสัตว์เลี้ยง",
    pendingConsent: "มีข้อมูลสุขภาพรอการอนุญาตในแชท ยังไม่ได้บันทึก",
    consentNote: (date: string) => `จำไว้โดยได้รับอนุญาต ${date}`,
    house: "บ้านและทรัพย์สิน",
    houseEmpty: "ยังไม่ได้บอก เช่น บ้านกี่ชั้น หรือมีรถไหม",
    line: "แจ้งเตือนทาง LINE",
    lineLinked: "เชื่อมกับ LINE แล้ว",
    lineNot: "ยังไม่ได้เชื่อม เพิ่มเพื่อนใน LINE เพื่อรับแจ้งเตือนเมื่อน้ำใกล้บ้านสูงขึ้น",
    signInToKeep: "เข้าสู่ระบบเพื่อเก็บข้อมูลนี้ไว้ในบัญชี",
    delete: "ลบ",
    deleteLabel: (what: string) => `ลบ ${what}`,
    deleteAll: "ลบข้อมูลทั้งหมด",
    open: "ดูทั้งหมด",
    close: "ปิด",
    deleteFailed: "ลบไม่สำเร็จ ลองอีกครั้งค่ะ",
  },

  footer: {
    unofficial: "น้ำมาไม่ใช่หน่วยงานรัฐ",
    emergency: "เหตุฉุกเฉินโทร",
    followOfficial: "ปฏิบัติตามประกาศอพยพของทางการเสมอ",
    dataCredit: "ข้อมูลระดับน้ำ: ThaiWater โดยสถาบันสารสนเทศทรัพยากรน้ำ (สสน.)",
  },

  hotline: {
    ddpm: "สายด่วน ปภ.",
    line: "LINE",
    medical: "เจ็บป่วยฉุกเฉิน",
    medicalNumber: "1669",
    note: "น้ำมาไม่ใช่หน่วยงานรัฐ ข้อมูลระดับน้ำจาก ThaiWater โดยสถาบันสารสนเทศทรัพยากรน้ำ (สสน.) ระดับเสี่ยงประเมินโดยน้ำมา โปรดปฏิบัติตามประกาศของทางการ",
  },

  stale: {
    // DS nm-stale: keep the old time visible.
    banner: (when: string) => `ข้อมูลล่าสุดเมื่อ ${when} ยังไม่มีข้อมูลใหม่จาก ThaiWater`,
    station: (when: string) => `ข้อมูลล่าสุดเมื่อ ${when} สถานีนี้ยังไม่มีข้อมูลใหม่`,
  },

  unknown: "ไม่ทราบ",

  tier: {
    normal: { label: "ปกติ", description: "ยังต่ำกว่าเกณฑ์เฝ้าระวัง" },
    watch: { label: "เฝ้าระวัง", description: "น้ำกำลังขึ้น และห่างตลิ่งไม่ถึง 0.5 ม." },
    warning: { label: "เตือนภัย", description: "อาจถึงตลิ่งภายใน 6 ชม. หรือสถานีต้นน้ำล้นตลิ่งแล้ว" },
    danger: { label: "ล้นตลิ่ง", description: "ระดับน้ำสูงกว่าตลิ่งแล้ว" },
    unknown: { label: "ไม่ทราบ", description: "ข้อมูลไม่พอประเมิน" },
  },

  map: {
    title: "ระดับน้ำลุ่มเจ้าพระยา",
    subtitle: "นครสวรรค์ → ชัยนาท → อยุธยา → กรุงเทพฯ",
    legend: "ระดับเสี่ยงที่สถานี",
    estimated: "ประเมินโดยน้ำมา",
    corridor: "สถานีตามลำน้ำ (ต้นน้ำ → ปลายน้ำ)",
    branches: "แม่น้ำสาขา",
    myLocation: "ตำแหน่งของฉัน",
    locating: "กำลังหาตำแหน่ง…",
    locationFailed: "เปิดตำแหน่งไม่ได้ แตะบนแผนที่เพื่อเลือกจุดแทน",
    pickHint: "แตะบนแผนที่เพื่อเลือกตำแหน่ง",
    nearYou: "สถานีใกล้ตำแหน่งนี้",
    pickedPoint: "ตำแหน่งที่เลือก",
    showHii: "แสดงสถานี สสน. (รายงานทุก 10 นาที)",
    tableView: "ดูเป็นตาราง",
    tilesFailed: "โหลดแผนที่ไม่ได้ ดูรายการสถานีด้านล่างแทน",
    close: "ปิด",
    back: "กลับไปรายการสถานี",
    corridorHint: "แตะสถานีเพื่อดูรายละเอียด",
  },

  flood: {
    title: "พื้นที่น้ำท่วมจากดาวเทียม",
    subtitle: "จากภาพถ่ายดาวเทียมของ GISTDA (สทอภ.) รวมเป็นรายจังหวัดและรายตำบล",
    period: { "3days": "3 วันล่าสุด", "7days": "7 วันล่าสุด" },
    periodLabel: "ช่วงเวลาของภาพดาวเทียม",
    total: "พื้นที่น้ำท่วมรวม",
    observed: "ภาพดาวเทียมล่าสุด",
    fetched: "ดึงข้อมูลเมื่อ",
    noData: "ยังไม่มีข้อมูลจาก GISTDA",
    noDataBody: "ระบบดึงภาพน้ำท่วมจาก GISTDA ทุก 3 ชั่วโมง ระหว่างนี้ดูระดับน้ำได้ที่แผนที่สถานี",
    none: (period: string) => `ภาพดาวเทียม ${period} ไม่พบพื้นที่น้ำท่วม`,
    tryWeek: "ดู 7 วันล่าสุด",
    allProvinces: "ทุกจังหวัด",
    byLevel: { province: "รายจังหวัด", amphoe: "รายอำเภอ", tambon: "รายตำบล" },
    sample: "โหมดจำลอง: พื้นที่น้ำท่วมในหน้านี้เป็นข้อมูลตัวอย่าง ไม่ใช่ข้อมูลจริงจาก GISTDA",
    caveat:
      "ดาวเทียมอาจมองไม่เห็นน้ำใต้เมฆ ใต้ต้นไม้ หรือในเขตเมือง และไม่ได้บอกความลึกของน้ำ ใช้ประกอบกับประกาศของทางการเสมอ",
    source: "ข้อมูลพื้นที่น้ำท่วม: GISTDA (สทอภ.) · ขอบเขตจังหวัดและตำบล: กรมแผนที่ทหาร ผ่าน OCHA (CC BY-IGO)",
    basemap: "พื้นหลังแผนที่",
    satellite: "ดาวเทียม",
    streets: "แผนที่ถนน",
    legend: "น้ำท่วมในพื้นที่",
    legendNote: "ท่วมมาก คือ น้ำท่วมตั้งแต่ราว 1 ใน 4 ของพื้นที่",
    cls: { many: "ท่วมมาก", some: "ท่วมบางส่วน", none: "ไม่พบน้ำ" },
    clsLong: { many: "ท่วมมาก", some: "ท่วมบางส่วน", none: "ไม่พบน้ำท่วม" },
    noneInArea: "ดาวเทียมไม่เห็นน้ำท่วมในตำบลนี้",
    inFlooded: "ในพื้นที่น้ำท่วม:",
    homeHere: (label: string) => `${label}อยู่ตำบลนี้`,
    zoomForTambons: "แตะจังหวัด หรือซูมเข้า เพื่อดูรายตำบล",
    loadingAreas: "กำลังโหลดแผนที่ตำบล…",
    areasFailed: "โหลดแผนที่ตำบลไม่ได้ ดูรายการพื้นที่ด้านล่างแทน",
    tilesFailed: "โหลดภาพแผนที่ไม่ได้ ดูรายการพื้นที่ด้านล่างแทน",
    imageDate: "ภาพดาวเทียมวันที่",
    tapHint: "แตะจังหวัดเพื่อซูมเข้า แตะตำบลเพื่อดูว่าน้ำท่วมมากแค่ไหน ซูมใกล้จะเห็นแอ่งน้ำที่ดาวเทียมเห็นในตำบล",
    zoomForWater: "ซูมเข้าอีก เพื่อดูว่าน้ำอยู่ตรงไหนในตำบล",
    loadingWater: "กำลังโหลดจุดที่น้ำท่วม…",
    waterFailed: "โหลดจุดที่น้ำท่วมไม่ได้",
    waterTruncated: "แสดงเฉพาะจุดที่ท่วมมากที่สุด ซูมเข้าเพื่อดูทั้งหมด",
    legendWater: "น้ำที่ดาวเทียมเห็น",
    legendBorder: "เขตตำบล",
    waterTitle: "แอ่งน้ำ",
    waterIn: (tambon: string) => `แอ่งน้ำใน ${tambon}`,
    waterRai: (rai: string) => `ท่วมราว ${rai}`,
    lessThanRai: "ไม่ถึง 1 ไร่",
    homeInWater: (label: string) => `${label}อยู่ในแอ่งน้ำนี้`,
    homeAway: (label: string, dist: string) => `ห่าง${label} ${dist}`,
    landDry: "ตรงนี้ไม่พบน้ำท่วม",
    nearestWater: (dist: string) => `น้ำที่ใกล้สุดห่างไป ${dist}`,
    noWaterInView: "ไม่พบน้ำท่วมในบริเวณที่เห็นบนแผนที่",
    landCaveat: "ดาวเทียมอาจมองไม่เห็นน้ำใต้เมฆ ใต้ต้นไม้ หรือในเขตเมือง",
    askPoint: "ถามน้ำมาเรื่องจุดนี้",
    selectHint: "แตะตำบลบนแผนที่ หรือในรายการ เพื่อดูรายละเอียด",
    stats: { buildings: "อาคาร", population: "คน" },
    rowStats: { buildings: "อาคาร", population: "คน" },
    close: "ปิด",
    askArea: "ถามน้ำมาเรื่องตำบลนี้",
    askAreaText: (place: string) => `น้ำท่วมที่${place}เป็นอย่างไรบ้าง ควรทำอะไร`,
    ask: "ถามน้ำมา",
    askPlaceText: (label: string) => `น้ำท่วมใกล้${label}แค่ไหน ควรทำอะไร`,
    placeAtPoint: (rai: string, km: number) => `ตรงที่ตั้งนี้มีน้ำท่วม · ในรัศมี ${km} กม. ท่วม ${rai}`,
    placeNear: (dist: string, rai: string, km: number) => `ใกล้สุด ${dist} · ในรัศมี ${km} กม. ท่วม ${rai}`,
    placeClear: (km: number) => `ไม่พบน้ำท่วมในรัศมี ${km} กม.`,
    placeApprox: "ตำแหน่งโดยประมาณ",
  },

  station: {
    levelAtStation: "ระดับน้ำที่สถานี",
    bank: "ตลิ่ง",
    gapToBank: "เทียบกับตลิ่ง",
    trend: "แนวโน้ม 3 ชม.",
    level: "ระดับน้ำ",
    bankLevel: "ระดับตลิ่ง",
    hoursToBank: "ถึงตลิ่งในอีก",
    discharge: "ปริมาณน้ำไหลผ่าน",
    upstream: "สถานีต้นน้ำ",
    upstreamOver: (codes: string[]) => `ล้นตลิ่งแล้ว (${codes.join(", ")})`,
    downstream: "สถานีปลายน้ำ",
    observedAt: "เวลาที่วัด",
    sourceLead: "ที่มา:",
    estimated: "ระดับเสี่ยงประเมินโดยน้ำมา",
    thaiwater: "ThaiWater (สสน.)",
    stationNotHouse:
      "ตัวเลขนี้คือระดับน้ำในแม่น้ำที่จุดสถานีวัด ไม่ใช่ระดับน้ำที่บ้าน ใช้ประกอบการตัดสินใจร่วมกับประกาศของทางการ",
    chartTitle: "ระดับน้ำ 72 ชั่วโมงล่าสุด",
    chartEmpty: "ยังไม่มีข้อมูลย้อนหลังของสถานีนี้",
    chartBankLine: "ระดับตลิ่ง",
    msl: "ม.รทก.",
  },

  shelter: {
    recommended: "ศูนย์พักพิงที่แนะนำ",
    nearby: "ศูนย์พักพิงใกล้เคียง",
    pick: "แนะนำ",
    open: "เปิดรับอยู่",
    closed: "ยังไม่เปิด",
    residents: (cur: number, cap: number) => `มีผู้พัก ${cur} / ${cap} คน`,
    patientsYes: "รับผู้ป่วยติดเตียง",
    patientsNo: "ไม่รับผู้ป่วยติดเตียง",
    patientsUnknown: "ไม่ได้ระบุว่ารับผู้ป่วยติดเตียง",
    far: "ไกล โทร 1784 ถามศูนย์ที่ใกล้กว่า",
    ddpmNote: "ข้อมูล ปภ. สถานะเปลี่ยนได้ · โทร 1784 ก่อนเดินทาง",
    manualNote: "โทร 1784 ถามก่อนเดินทางว่าศูนย์ยังรับคนได้",
    openMap: "เปิดใน Google Maps",
  },

  vulnerable: {
    elderly: "ผู้สูงอายุ",
    bedridden: "ผู้ป่วยติดเตียง",
    child: "เด็ก",
    infant: "ทารก",
    pregnant: "หญิงตั้งครรภ์",
    disabled: "ผู้พิการ",
    patient: "ผู้ป่วย",
    pet: "สัตว์เลี้ยง",
  },

  chat: {
    title: "ถามเรื่องน้ำท่วม",
    intro:
      "สวัสดีค่ะ ถามเรื่องระดับน้ำใกล้บ้านได้เลยค่ะ เช่น “บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม” เราตอบจากสถานีวัดน้ำจริง และบอกที่มาทุกครั้งค่ะ",
    inputLabel: "พิมพ์คำถาม",
    placeholder: "ถามต่อ เช่น น้ำจะขึ้นอีกไหม",
    send: "ส่ง",
    shareLocation: "ส่งตำแหน่ง",
    locating: "กำลังหาตำแหน่ง…",
    locationFailed: "เปิดตำแหน่งไม่ได้ ลองพิมพ์ชื่ออำเภอหรือตำบลแทน",
    typing: "กำลังตอบ…",
    failed: "ส่งไม่สำเร็จ",
    retry: "ลองอีกครั้ง",
    sentLocation: "ส่งตำแหน่งปัจจุบันแล้ว",
    emergencyTitle: "ถ้าอยู่ในอันตรายตอนนี้ โทรขอความช่วยเหลือก่อนค่ะ",
    // DS starter chips: what a person would say, 20 characters or fewer. `fill` starts the sentence in the
    // composer for the person to finish (it needs their place); `send` sends at once.
    starters: [
      { label: "น้ำจะถึงบ้านไหม", fill: "บ้านอยู่" },
      { label: "ดูบ้านพ่อแม่", fill: "บ้านพ่อแม่อยู่" },
      { label: "หาศูนย์พักพิง", fill: "ศูนย์พักพิงแถว" },
      { label: "น้ำเข้าบ้านแล้ว", send: "น้ำเข้าบ้านแล้ว ช่วยด้วย", urgent: true },
    ] as Starter[],
    newChat: "เริ่มคุยใหม่",
    sourcesLabel: "ที่มา",
  },

  errors: {
    generic: "เกิดข้อผิดพลาด",
    retry: "ลองอีกครั้ง",
    pageCrashed: "หน้านี้แสดงผลไม่ได้",
    reload: "โหลดหน้าใหม่",
    loading: "กำลังโหลด…",
  },

  demo: {
    title: "แผงเดโม",
    raiseTier: "ปรับระดับความเสี่ยงสถานี",
    station: "สถานี",
    tier: "ระดับ",
    apply: "ใช้",
    clearOverrides: "ล้างการปรับระดับ",
    reset: "รีเซ็ตข้อมูลเดโมทั้งหมด",
    account: "บัญชี",
    signedOut: "ไม่ได้เข้าสู่ระบบ",
  },
};

export type Starter = { label: string; fill?: string; send?: string; urgent?: boolean };

export function agencyName(agency: string | null): string {
  switch (agency) {
    case "RID":
      return "กรมชลประทาน";
    case "HII":
      return "สถาบันสารสนเทศทรัพยากรน้ำ (สสน.)";
    case "EGAT":
      return "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)";
    case null:
    case undefined:
      return "ไม่ระบุหน่วยงาน";
    default:
      return agency;
  }
}
