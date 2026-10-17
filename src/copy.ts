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
    chat: "แชท",
    map: "แผนที่",
    dashboard: "เจ้าหน้าที่",
  },

  footer: {
    unofficial: "น้ำมาไม่ใช่หน่วยงานราชการ",
    emergency: "เหตุฉุกเฉินโทร",
    followOfficial: "ปฏิบัติตามประกาศอพยพของทางการเสมอ",
    dataCredit: "ข้อมูลระดับน้ำ: ThaiWater โดยสถาบันสารสนเทศทรัพยากรน้ำ (สสน.)",
    callButton: "โทร 1784",
  },

  hotline: {
    ddpm: "สายด่วน ปภ.",
    line: "LINE",
    medical: "เจ็บป่วยฉุกเฉิน",
    medicalNumber: "1669",
    note: "น้ำมาไม่ใช่หน่วยงานราชการ ข้อมูลระดับน้ำจาก ThaiWater โดยสถาบันสารสนเทศทรัพยากรน้ำ (สสน.) ระดับเสี่ยงประเมินโดยน้ำมา โปรดปฏิบัติตามประกาศของทางการ",
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

  dashboard: {
    title: "คำขอความช่วยเหลือ",
    banner: "สำหรับเจ้าหน้าที่กู้ภัยเท่านั้น ข้อมูลส่วนบุคคลใช้เพื่อการช่วยเหลือเท่านั้น",
    newTag: "ใหม่",
    openInMaps: "เปิดใน Google Maps",
    location: "ตำแหน่ง",
    people_: "ผู้ประสบภัย",
    assignee: "ผู้รับผิดชอบ",
    cancel: "ยกเลิกคำขอ",
    tapToView: "แตะเพื่อดู",
    filters: {
      active: "ยังไม่ปิด",
      open: "รอรับเรื่อง",
      in_progress: "กำลังดำเนินการ",
      closed: "ปิดแล้ว",
    },
    empty: "ไม่มีคำขอในหมวดนี้",
    newTicket: "มีคำขอความช่วยเหลือใหม่",
    people: (n: number | null) => (n == null ? "ไม่ทราบจำนวนคน" : `${n} คน`),
    noLocation: "ไม่มีพิกัด",
    message: "ข้อความจากผู้ขอ",
    contact: "เบอร์ติดต่อ",
    vulnerable: "กลุ่มเปราะบาง",
    needs: "สิ่งที่ต้องการ",
    nearestStation: "สถานีวัดน้ำใกล้ที่สุด",
    shelters: "ศูนย์พักพิงใกล้เคียง",
    sheltersPatients: "ศูนย์พักพิงที่รับผู้ป่วย",
    setStatus: "เปลี่ยนสถานะ",
    conflict: "มีผู้อื่นแก้ไขคำขอนี้ไปแล้ว โหลดข้อมูลล่าสุดแล้ว ลองอีกครั้ง",
    saveFailed: "บันทึกไม่สำเร็จ",
    loginTitle: "สำหรับเจ้าหน้าที่",
    loginBody: "หน้านี้แสดงข้อมูลผู้ขอความช่วยเหลือ ต้องเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่",
    loginDemo: "เข้าสู่ระบบเจ้าหน้าที่ (โหมดทดลอง)",
    loginLine: "เข้าสู่ระบบด้วย LINE",
    loginNotReady: "การเข้าสู่ระบบด้วย LINE ยังไม่เปิดใช้",
    forbidden: "บัญชีนี้ไม่มีสิทธิ์เจ้าหน้าที่",
    channel: { line: "LINE", web: "เว็บ" },
  },

  urgency: {
    critical: "ด่วนมาก",
    high: "ด่วน",
    normal: "ปกติ",
  },

  status: {
    open: "รอรับเรื่อง",
    acknowledged: "รับเรื่องแล้ว",
    in_progress: "กำลังเดินทาง",
    resolved: "ช่วยเหลือแล้ว",
    cancelled: "ยกเลิก",
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

  needs: {
    evacuation: "อพยพ",
    medical: "การแพทย์",
    medication: "ยา",
    oxygen: "ออกซิเจน",
    dialysis: "ฟอกไต",
    food_water: "อาหาร/น้ำดื่ม",
    boat: "เรือ",
    power: "ไฟฟ้า",
  },

  chat: {
    title: "ถามเรื่องน้ำท่วม",
    intro:
      "สวัสดีค่ะ ถามเรื่องระดับน้ำใกล้บ้านได้เลยค่ะ เช่น “บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม” เราตอบจากสถานีวัดน้ำจริง และบอกที่มาทุกครั้งค่ะ",
    inputLabel: "พิมพ์คำถาม",
    placeholder: "เช่น บ้านแม่อยู่บางบาล",
    send: "ส่ง",
    shareLocation: "ส่งตำแหน่ง",
    locating: "กำลังหาตำแหน่ง…",
    locationFailed: "เปิดตำแหน่งไม่ได้ ลองพิมพ์ชื่ออำเภอหรือตำบลแทน",
    typing: "กำลังตอบ…",
    failed: "ส่งไม่สำเร็จ",
    retry: "ลองอีกครั้ง",
    sentLocation: "ส่งตำแหน่งปัจจุบันแล้ว",
    ticketCreated: (id: number) => `ส่งเรื่องขอความช่วยเหลือแล้ว เลขที่ #${id}`,
    emergencyTitle: "ถ้าอยู่ในอันตรายตอนนี้ โทรขอความช่วยเหลือก่อนค่ะ",
    starters: [
      "บ้านแม่อยู่บางบาล อยุธยา น้ำจะถึงไหม",
      "ระดับน้ำที่บ้านป้อมตอนนี้เป็นยังไง",
      "ศูนย์พักพิงใกล้บางบาลมีที่ไหนบ้าง",
    ],
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
    injectTicket: "เพิ่มคำขอช่วยเหลือตัวอย่าง",
    reset: "รีเซ็ตข้อมูลเดโมทั้งหมด",
    role: "บทบาท",
  },
};

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
