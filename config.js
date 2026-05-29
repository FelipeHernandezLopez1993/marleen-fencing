/* ═══════════════════════════════════════════════════════════════
   MARLEEN — ATHLETE CONFIG
   ───────────────────────────────────────────────────────────────
   This is the ONLY file that changes between athletes.
   To create a new athlete: copy index.html + styles.css + app.js
   unchanged, and write a new version of THIS file.
   The shared engine (app.js) reads everything below.
   ═══════════════════════════════════════════════════════════════ */

// ── Cloud database (this athlete's own Supabase project) ──
const SUPABASE = {
  url: 'https://wlhtyfzpofnnuhdoeyqx.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaHR5Znpwb2ZubnVoZG9leXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNjgzMzQsImV4cCI6MjA5NTY0NDMzNH0.irKKebHBK7_JCUYydoDrV11LEBfWxmEf9pq63nwVVHs',
};

// ── Brand / theme ──
const THEME = { accent: '#3D9BE9' };
const BRAND = {
  title: 'MARLEEN',
  sub: 'FENCING',
  programLabel: '22-WEEK PROGRAM',
};

// ── Program timeline ──
const PROGRAM_START = '2026-05-26';   // Tuesday
const TOTAL_WEEKS   = 22;

// ── Athlete profile ──
const USER = {
  name:'Marleen', age:25, weight:55, height:172, targetWeight:59,
  lifts:{
    'Trap bar deadlift':{w:40,r:5},'Front squat':{w:30,r:6},
    'Leg press':{w:60,r:10},'Hip thrust':{w:40,r:8},
    'Single-leg press':{w:35,r:8},'Nordic hamstring curl':{w:0,r:8},
    'Weighted pull-ups':{w:0,r:5},'DB rows':{w:14,r:8},
    'Face pulls':{w:15,r:15},'Wrist curls':{w:8,r:15},
    'DB shoulder press':{w:10,r:8},'DB bench press':{w:12,r:10},
    'Lat pulldown':{w:30,r:10},'Rear delt flies':{w:6,r:15},
    'Tricep pushdown':{w:20,r:12},'Goblet squat':{w:18,r:8},
    'Reverse lunge':{w:0,r:8},'Jump squats':{w:8,r:8},
  }
};

// ── Daily nutrition targets ──
const NUTRITION = {
  double:{kcal:2800,protein:130,carbs:330,fat:80},
  single:{kcal:2500,protein:130,carbs:270,fat:75},
  rest:  {kcal:2100,protein:130,carbs:185,fat:70},
};
const NUTRITION_NOTE = '130g protein protects and builds muscle during your weight-gain phase. Carbs are your fuel — highest on double-session days. Eat to grow, not to maintain.';

// ── Countdowns (replaces "race dates") ──
const COMPETITIONS = [
  { key:'nationals', label:'NATIONALS', date:'2026-06-13', color:'var(--accent)', icon:'🏆' },
  { key:'europeans', label:'EUROPEANS', date:'2026-06-16', color:'var(--yellow)', icon:'🥇' },
];

// ── Phases (index = phase number; 0 unused) ──
const PHASES = [
  null,
  { name:'Competition Ready',  color:'var(--green)'  },
  { name:'Foundation',         color:'var(--yellow)' },
  { name:'Summer Build',       color:'var(--accent)' },
  { name:'Competition Season', color:'var(--teal)'   },
];

// ── Session types: label + colour + which log form to use ──
const SESSION_TYPES = {
  strength:{ label:'Strength', color:'var(--orange)', form:'strength' },
  fencing: { label:'Fencing',  color:'var(--accent)', form:'fencing'  },
  run:     { label:'Run',      color:'var(--green)',  form:'run'      },
  yoga:    { label:'Yoga',     color:'var(--purple)', form:'yoga'     },
  rest:    { label:'Rest',     color:'var(--muted)',  form:null       },
  custom:  { label:'Custom',   color:'var(--teal)',   form:'custom'   },
};

// ── Which per-week numbers to show on the Plan tab ──
const WEEK_STATS = [
  { key:'gym',      label:'gym days' },
  { key:'sessions', label:'sessions' },
  { key:'fencing',  label:'fencing'  },
];

// ── Performance tab: which session types to track adherence for ──
const PERF_TYPES = ['strength','fencing','run','yoga'];

// ═══════════════════════════════════════════
//  EXERCISES (strength session library)
// ═══════════════════════════════════════════
const EXERCISES = {
  'Power Lower A':[
    {name:'Trap bar deadlift',    reps:5,  note:'Hinge at hips · brace core · drive through floor · knees track over toes'},
    {name:'Box jumps',            reps:5,  note:'Land softly · reset fully each rep · drive from hips · quality over speed'},
    {name:'Leg press',            reps:10, note:'Feet shoulder-width · full depth · drive through heels · no knees caving'},
    {name:'Hip thrust',           reps:8,  note:'Full hip extension · squeeze glutes at top · upper back on bench'},
    {name:'Nordic hamstring curl',reps:8,  note:'Eccentric only if needed · control the descent · essential for sprint + lunge health'},
    {name:'Calf raises',          reps:15, note:'Full ROM · pause at top · slow eccentric · fencing footwork runs on calves'},
  ],
  'Power Lower B':[
    {name:'Front squat',          reps:6,  note:'Elbows high · chest up · knees track over toes · hip-safe alternative to back squat'},
    {name:'Jump squats',          reps:8,  note:'Controlled landing · explode from hips · lightweight or bodyweight · fencing explosiveness'},
    {name:'Single-leg press',     reps:8,  note:'Each leg separately · full depth · control the return · reveals left/right imbalances'},
    {name:'Hip thrust',           reps:8,  note:'Drive hips to ceiling · glute squeeze at top · protects hip flexor'},
    {name:'Copenhagen plank',     reps:20, note:'Seconds per side · hip adductor strength is critical for lunge stability and groin health'},
    {name:'Calf raises',          reps:15, note:'Full ROM · pause at top'},
  ],
  'Athletic Upper A':[
    {name:'Weighted pull-ups',    reps:5,  note:'Dead hang start · chest to bar · controlled descent · shoulder blade activation'},
    {name:'DB rows',              reps:8,  note:'Single-arm or chest-supported · pull to hip not chest · feel the lat contract'},
    {name:'Face pulls',           reps:15, note:'Pull to forehead · external rotate at end · slow eccentric · rotator cuff health'},
    {name:'Wrist curls',          reps:15, note:'Full ROM · feel the forearm load · grip strength = blade precision under fatigue'},
    {name:'Farmer carry',         reps:30, note:'Meters · walk tall · grip hard · core braced · this is fencing endurance in disguise'},
    {name:'Dead hang',            reps:20, note:'Seconds · grip and shoulder stability · active scapula at top'},
  ],
  'Athletic Upper B':[
    {name:'DB shoulder press',    reps:8,  note:'Full ROM overhead · overhead stability = blade control · feel the shoulder joint'},
    {name:'DB bench press',       reps:10, note:'Control descent · drive up · feel the chest working'},
    {name:'Lat pulldown',         reps:10, note:'Pull to chin · squeeze lats at bottom · elbows down'},
    {name:'Rear delt flies',      reps:15, note:'Light weight · bend elbows slightly · squeeze at top · posture and shoulder health'},
    {name:'Plate pinch',          reps:35, note:'Seconds · pinch 2 plates together · grip focused · direct forearm strength for fencing'},
    {name:'Tricep pushdown',      reps:12, note:'Elbows locked · squeeze at bottom · arm extension power'},
  ],
  'Total Body Athletic':[
    {name:'Goblet squat',         reps:8,  note:'Elbows between knees at bottom · chest up · weight in heels · hip-safe loading'},
    {name:'Med ball slams',       reps:10, note:'Full extension overhead · slam with intent · hip drive matters · explosive chain'},
    {name:'Pallof press',         reps:12, note:'Anti-rotation · resist the cable pull · arms fully extended · rotational core for fencing'},
    {name:'Reverse lunge',        reps:8,  note:'Per side · step back · back knee near floor · drive through front heel · hip-safe'},
    {name:'Copenhagen plank',     reps:25, note:'Seconds per side · lateral hip stability · groin and adductor health'},
    {name:'Side plank',           reps:30, note:'Seconds per side · lateral stability for explosive direction changes on the piste'},
  ],
};

// ═══════════════════════════════════════════
//  SUPPLEMENTS
// ═══════════════════════════════════════════
const SUPPS = [
  {name:'Creatine 5g', time:'Morning', key:'creatine',
   why:'Explosive power for lunges, attacks, and direction changes. Builds up in muscle tissue over 3–4 weeks — consistency is everything. Boosts explosive strength 5–10% and speeds recovery between hard fencing exchanges.'},
  {name:'Protein shake 30g', time:'Post-workout or with meals', key:'protein',
   why:'You\'re in a muscle-building phase — your body needs raw material. At your training volume, hitting 130g/day total protein is non-negotiable. Shakes bridge the gap when food isn\'t enough. Daily total matters more than timing.'},
  {name:'Vitamin C 1000mg', time:'Morning with multivitamin', key:'vitc',
   why:'Immune support during heavy training. Also essential for collagen synthesis — means faster tendon recovery for the hip. Works synergistically with your multivitamin.'},
  {name:'Omega-3 3g', time:'Morning with food', key:'omega3',
   why:'Anti-inflammatory — reduces chronic inflammation from daily fencing and gym. Also supports cognitive function and reaction speed, which matter as much as the physical in fencing. Take with your fattiest meal.'},
  {name:'Magnesium 400mg', time:'Evening only — never morning', key:'mag',
   why:'Given your fatigue, you may be depleted from sweating. Activates the parasympathetic system — take at night for muscle relaxation, better deep sleep, fewer cramps. Glycinate form absorbs best.'},
  {name:'Calcium 500mg', time:'With meals (not with iron-rich food)', key:'calcium',
   why:'Bone density — critical for female athletes under explosive loading. Important note: calcium blocks iron absorption. If you\'re treating low iron, don\'t take calcium at the same time as iron-rich meals or iron supplements.'},
  {name:'All-in-One Multivitamin', time:'Morning with food', key:'multi',
   why:'Covers your micronutrient bases. Pay attention to the iron content. If fatigue and low energy persist after 4 weeks of consistent supplementation, ask your doctor for a full blood panel: iron, ferritin, B12, and vitamin D3.'},
];

// ═══════════════════════════════════════════
//  HABITS
// ═══════════════════════════════════════════
const HABITS = [
  {key:'training', label:'Training',    icon:'⚔️', auto:true,  desc:'Complete at least one session today',
   why:'Every session builds the athletic foundation that wins matches. Consistency over 22 weeks is what separates good from elite.'},
  {key:'water',    label:'Hydration',   icon:'💧', auto:true,  desc:'Hit your daily water target',
   why:'Dehydration is likely contributing to your fatigue. Even 1–2% dehydration measurably reduces reaction time, strength, and focus — all things that matter in fencing.'},
  {key:'supps',    label:'Supplements', icon:'💊', auto:true,  desc:'All active supplements checked',
   why:'Supplements only work with consistency. Creatine, magnesium, and omega-3 all require daily loading. Skipping days resets the cumulative effect.'},
  {key:'meds',     label:'Meds',        icon:'💉', auto:false, desc:'Take prescribed medicine',
   why:'Prescribed treatments work when taken consistently. Don\'t skip — your recovery and energy levels depend on it.'},
  {key:'stretch',  label:'Stretch',     icon:'🤸', auto:false, desc:'Stretch or yoga session',
   why:'Hip mobility is non-negotiable with your injury. 10 min of daily mobility work prevents the setbacks that derail entire training blocks. This one habit protects everything else.'},
  {key:'diary',    label:'Diary',       icon:'✍️', auto:false, desc:'Write in your diary',
   why:'High-level fencing is as mental as physical. Writing helps you process competition anxiety, track patterns in your performance, and stay accountable.'},
  {key:'craft',    label:'Craft / Read',icon:'📖', auto:false, desc:'Craft or read for 20 min',
   why:'Creative and intellectual rest recharges the mind differently than sleep. It builds the mental resilience and focus that separate athletes at the European level.'},
];

// ═══════════════════════════════════════════
//  QUOTES
// ═══════════════════════════════════════════
const QUOTES = [
  // ── Fencing ──
  {text:"I didn't win because I was born with a gift. I won because I showed up every single day.",author:"Laura Flessel — 2× Olympic Champion, Fencing (Épée)"},
  {text:"The piste is where you prove what the training room built. Trust your preparation.",author:"Valentina Vezzali — 6× World Champion, 3× Olympic Gold, Fencing"},
  {text:"Fencing is chess at the speed of lightning. Whoever thinks faster, wins.",author:"Aladár Gerevich — 7× Olympic Gold Medalist, Sabre"},
  {text:"The blade goes where the mind points it.",author:"Fencing proverb"},
  {text:"Victory belongs to the most persevering.",author:"Napoleon Bonaparte — himself a passionate fencer"},
  {text:"The sword knows no favourites. Only those who have earned it.",author:"Mariel Zagunis — 2× Olympic Champion, Sabre"},
  {text:"Every touch is a small decision. Make a thousand good small decisions and you will win.",author:"Fencing coaching principle"},
  {text:"Technique without speed is academic. Speed without technique is reckless. The master has both.",author:"Anonymous fencing master"},
  // ── Dutch / Athletics heroes ──
  {text:"I always believed that if I kept working, one day people would see what I could do. That day came.",author:"Dafne Schippers — 2× World Champion 200m, Netherlands"},
  {text:"When people say it's impossible, that's when I start.",author:"Sifan Hassan — Olympic 5000m & 10000m Champion, Netherlands"},
  {text:"No matter how hard it gets, I find a way to smile and keep moving.",author:"Sifan Hassan — Olympic Champion"},
  {text:"I want to show the world that a woman from the Netherlands can be the fastest on earth.",author:"Dafne Schippers — World Champion"},
  {text:"Run your own race. Not someone else's.",author:"Eliud Kipchoge — First human to run marathon under 2 hours"},
  {text:"Only the disciplined ones are free. If you're not disciplined, you are a slave to your moods and passions.",author:"Eliud Kipchoge — Olympic Marathon Champion"},
  {text:"I trained four years for this moment. Everything was for this.",author:"Neeraj Chopra — Olympic Gold, Javelin"},
  {text:"If you dream of winning, you've already started.",author:"Usain Bolt — 8× Olympic Champion, Sprint"},
  // ── Science & Mathematics ──
  {text:"Nothing in life is to be feared, it is only to be understood.",author:"Marie Curie — First woman to win a Nobel Prize, winner of two"},
  {text:"I was taught that the way of progress is neither swift nor easy.",author:"Marie Curie — Nobel Prize in Physics & Chemistry"},
  {text:"The most important thing is not to stop questioning. Curiosity has its own reason for existing.",author:"Albert Einstein — Nobel Prize Physics"},
  {text:"In the middle of difficulty lies opportunity.",author:"Albert Einstein"},
  {text:"Imagination is more important than knowledge. Knowledge is limited. Imagination encircles the world.",author:"Albert Einstein"},
  {text:"There is no more honest beauty than a proof.",author:"Emmy Noether — one of the greatest mathematicians in history"},
  {text:"The most important equations are those written in the heart.",author:"Katherine Johnson — NASA mathematician who calculated Apollo trajectories"},
  {text:"Numbers are the highest degree of knowledge. It is knowledge itself.",author:"Plato"},
  {text:"Pure mathematics is, in its way, the poetry of logical ideas.",author:"Albert Einstein"},
  // ── Historic figures who changed humanity ──
  {text:"It always seems impossible until it's done.",author:"Nelson Mandela"},
  {text:"Education is the most powerful weapon you can use to change the world.",author:"Nelson Mandela"},
  {text:"I am not afraid. I was born to do this.",author:"Joan of Arc — military leader and saint"},
  {text:"One child, one teacher, one book, one pen can change the world.",author:"Malala Yousafzai — youngest Nobel Peace Prize laureate"},
  {text:"I raise up my voice — not so I can shout, but so that those without a voice can be heard.",author:"Malala Yousafzai"},
  {text:"You gain strength, courage and confidence by every experience in which you really stop to look fear in the face.",author:"Eleanor Roosevelt"},
  {text:"The question isn't who is going to let me; it's who is going to stop me.",author:"Ayn Rand"},
  {text:"I am no bird; and no net ensnares me: I am a free human being with an independent will.",author:"Charlotte Brontë — Jane Eyre"},
  // ── Stoic / philosophical ──
  {text:"You have power over your mind, not outside events. Realize this, and you will find strength.",author:"Marcus Aurelius — Roman Emperor, Meditations"},
  {text:"The impediment to action advances action. What stands in the way becomes the way.",author:"Marcus Aurelius"},
  {text:"Waste no more time arguing about what a good person should be. Be one.",author:"Marcus Aurelius"},
  {text:"First say to yourself what you would be; and then do what you have to do.",author:"Epictetus — Stoic philosopher, former slave"},
  {text:"He who has a why to live can bear almost any how.",author:"Friedrich Nietzsche"},
  {text:"The first and best victory is to conquer self.",author:"Plato"},
  // ── Champions & athletes ──
  {text:"I've failed over and over and over again in my life. And that is why I succeed.",author:"Michael Jordan"},
  {text:"Hard work beats talent when talent doesn't work hard.",author:"Kevin Durant"},
  {text:"Do not pray for an easy life. Pray for the strength to endure a difficult one.",author:"Bruce Lee"},
  {text:"Be water, my friend.",author:"Bruce Lee"},
  {text:"If you want to be the best, you have to do things that other people aren't willing to do.",author:"Michael Phelps — 23× Olympic Gold"},
  {text:"Courage means feeling the fear and doing it anyway.",author:"Gabby Douglas — Olympic Gymnastics All-Around Champion"},
  {text:"You are in danger of living a life so comfortable that you will die without ever realizing your true potential.",author:"David Goggins"},
  {text:"Only the disciplined ones are free.",author:"Eliud Kipchoge"},
];

// ═══════════════════════════════════════════
//  22-WEEK TRAINING PLAN
//  Days: 0=Mon … 6=Sun. Program starts Tue May 26 2026.
// ═══════════════════════════════════════════
const PLAN = [
  // ══ PHASE 1: COMPETITION READY (W1-3) ══
  {ph:1,lbl:'W1',gym:1,sessions:3,fencing:1,days:[
    {am:{t:'rest',n:'Rest',d:'Program starts Friday — rest, prepare mentally, check your gear',dur:''},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
    {am:{t:'strength',n:'Power Lower A — Intro',d:'Hip thrust 3×12 @35kg · Leg press 3×12 @55kg · Box jumps 3×5 BW · Nordic 2×8 · Calf raises 3×15 · Hip prehab: clamshells 2×15/side',dur:'50m'},pm:{t:'fencing',n:'Fencing PM',d:'Normal coach session',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'Morning fencing session',dur:'90m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'Focus on hip openers — pigeon pose, figure-4, hip flexor stretch',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'Full rest · foam roll · sleep well',dur:''},pm:null},
  ]},
  {ph:1,lbl:'W2',gym:2,sessions:6,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 3×8 @40kg · Box jumps 3×5 · Leg press 3×10 @60kg · Hip thrust 3×10 @40kg · Nordic 2×8 · Calf 3×15',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'Coach session',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'Morning session',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 3×5 BW · DB rows 3×10 @14kg · Face pulls 3×15 @12kg · Wrist curls 3×15 @8kg · Farmer carry 3×30m @10kg/hand',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'Coach session',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'Morning session',dur:'90m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'Light stretch · recovery',dur:''},pm:{t:'fencing',n:'Fencing PM',d:'Friday session (on/off)',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'Hip mobility focus · lower back · hamstrings',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:1,lbl:'W3',gym:2,sessions:5,fencing:3,days:[
    {am:{t:'strength',n:'Power Lower A — Pre-Competition',d:'Trap bar DL 3×6 @42.5kg · Box jumps 3×5 · Leg press 3×10 @60kg · Hip thrust 3×8 @40kg · Calf 2×15 · LIGHT — nationals this week',dur:'45m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A — Pre-Competition',d:'Pull-ups 3×5 · Rows 3×8 @14kg · Face pulls 3×12 · LIGHT — feel good, no fatigue',dur:'40m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'Easy session — sharp but not exhausting before nationals',dur:'90m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'Full rest · foam roll · visualize tomorrow · sleep early',dur:''},pm:null},
    {am:{t:'fencing',n:'NATIONALS 🏆',d:'National Championship — give everything. Trust your body. Trust your training.',dur:'4h'},pm:null},
    {am:{t:'rest',n:'Recovery',d:'Active recovery · celebrate · prepare mentally for Europeans in 3 days',dur:''},pm:null},
  ]},
  // ══ PHASE 2: FOUNDATION (W4-6) ══
  {ph:2,lbl:'W4',gym:2,sessions:4,fencing:3,days:[
    {am:{t:'fencing',n:'EUROPEANS 🥇',d:'European Championship — the most important competition of your season. Everything has been building for this moment. Go.',dur:'4h'},pm:null},
    {am:{t:'rest',n:'Recovery',d:'Post-competition rest · celebrate · let the body recover',dur:''},pm:null},
    {am:{t:'strength',n:'Power Lower — Light Return',d:'Leg press 3×10 @55kg · Hip thrust 3×10 @35kg · Calf 2×15 · Light return — no max effort',dur:'35m'},pm:{t:'fencing',n:'Fencing PM',d:'Return to training',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'Back to normal training',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper — Light Return',d:'Pull-ups 3×5 · DB rows 3×8 @12kg · Face pulls 3×15 · Easy session',dur:'35m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'Post-competition recovery yoga · hip openers · full body stretch',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:2,lbl:'W5',gym:3,sessions:6,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 4×6 @50kg · Box jumps 3×5 · Leg press 3×10 @70kg · Hip thrust 3×10 @50kg · Nordic 3×8 · Calf 3×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+2.5kg · DB rows 3×10 @16kg · Face pulls 3×15 · Wrist curls 3×15 · Farmer carry 3×30m @13kg/hand',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 3×10 @22kg · Med ball slams 3×12 · Pallof press 3×12 @20kg · Reverse lunge 3×10/side @8kg · Side plank 3×30s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'Saturday yoga',dur:'60m'},pm:{t:'run',n:'Easy Run',d:'~3 km Zone 2 · 20 min · warm up 5 min walk · check hip first',dur:'20m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:2,lbl:'W6',gym:3,sessions:6,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 4×6 @55kg · Box jumps 4×5 · Leg press 3×10 @77.5kg · Hip thrust 3×10 @57.5kg · Nordic 3×8 · Calf 3×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+5kg · DB rows 3×10 @17kg · Face pulls 3×15 · Wrist curls 3×15 · Farmer carry 3×30m @14kg/hand',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 3×10 @24kg · Med ball slams 4×12 · Pallof press 3×12 @22kg · Reverse lunge 3×10/side @10kg · Side plank 3×30s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'Last fencing before summer break 🏖️',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~4 km Zone 2 · 25 min',dur:'25m'}},
    {am:{t:'rest',n:'Rest',d:'Summer build starts next week — no fencing until September',dur:''},pm:null},
  ]},
  // ══ PHASE 3: SUMMER BUILD (W7-14) — NO FENCING ══
  {ph:3,lbl:'W7',gym:4,sessions:5,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 4×5 @62.5kg · Box jumps 4×5 · Leg press 3×10 @87.5kg · Hip thrust 4×8 @67.5kg · Nordic 3×8 · Calf 4×15',dur:'65m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+10kg · DB rows 4×8 @18kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 3×30m @15kg/hand · Dead hang 3×25s',dur:'65m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'Light walk · foam roll · hip mobility circuit · stretch',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 4×8 @28kg · Med ball slams 4×12 · Pallof press 3×12 @24kg · Reverse lunge 4×8/side @8kg · Copenhagen plank 3×25s · Finisher: 4 rounds — 10 KB swings @16kg + 5 box jumps, 45s rest',dur:'70m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 4×8 @14kg · DB bench 3×10 @14kg · Lat pulldown 3×10 @37.5kg · Rear delt flies 3×15 @7kg · Plate pinch 3×35s · Tricep 3×12',dur:'60m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'Summer full-body yoga',dur:'60m'},pm:{t:'run',n:'Run',d:'~4 km Zone 2 · 25 min · flat route',dur:'25m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:3,lbl:'W8',gym:4,sessions:5,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower B',d:'Front squat 4×6 @40kg · Jump squats 4×8 @10kg · Single-leg press 3×10 @45kg · Hip thrust 4×8 @72.5kg · Copenhagen plank 3×25s · Calf 4×15',dur:'65m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+12.5kg · DB rows 4×8 @19kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 3×30m @16kg/hand',dur:'65m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'Hip mobility · foam roll · stretch',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 4×8 @30kg · Med ball slams 4×12 · Pallof press 3×12 @26kg · Reverse lunge 4×8/side @10kg · Copenhagen plank 3×30s · Finisher: 4 rounds — 8 KB swings @20kg + 6 lateral bounds + 30s rest',dur:'70m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 4×8 @15kg · DB bench 3×10 @15kg · Lat pulldown 3×10 @40kg · Rear delt 3×15 · Plate pinch 3×40s · Tricep 3×12',dur:'60m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~5 km Zone 2 · 30 min',dur:'30m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:3,lbl:'W9',gym:4,sessions:5,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 4×5 @70kg · Box jumps 4×5 · Leg press 4×8 @95kg · Hip thrust 4×8 @80kg · Nordic 3×8 · Calf 4×15',dur:'65m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+15kg · DB rows 4×8 @20kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 4×30m @18kg/hand',dur:'65m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 4×8 @32kg · Med ball slams 4×12 · Pallof press 4×10 @28kg · Reverse lunge 4×8/side @12kg · Copenhagen plank 3×35s · Finisher: 5 rounds — 8 KB swings @20kg + 4 broad jumps, 45s rest',dur:'70m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 4×8 @16kg · DB bench 3×10 @16kg · Lat pulldown 3×10 @42.5kg · Rear delt 3×15 · Plate pinch 3×40s',dur:'60m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~5 km Zone 2 · 30 min · strong pace',dur:'30m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:3,lbl:'W10',gym:4,sessions:5,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower B',d:'Front squat 4×5 @47.5kg · Jump squats 4×8 @12kg · Single-leg press 4×8 @55kg · Hip thrust 4×8 @85kg · Copenhagen plank 3×30s · Calf 4×15',dur:'65m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+17.5kg · DB rows 4×8 @21kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 4×30m @19kg/hand',dur:'65m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'Hip mobility · walk 30 min',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 4×6 @36kg · Med ball slams 4×15 · Pallof press 4×10 @30kg · Reverse lunge 4×8/side @14kg · Copenhagen plank 4×30s · Finisher: 5 rounds — 10 KB swings @22kg + 5 box jumps, 45s rest',dur:'70m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 4×8 @18kg · DB bench 4×8 @17kg · Lat pulldown 4×8 @45kg · Rear delt 3×15 · Plate pinch 3×45s',dur:'60m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~5.5 km Zone 2 · 35 min',dur:'35m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:3,lbl:'W11',gym:3,sessions:4,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower A — Deload',d:'Trap bar DL 3×5 @55kg · Box jumps 2×5 · Leg press 3×8 @75kg · Hip thrust 3×8 @65kg · Calf 2×15 · Deload: weights ~20% below last week — let the body absorb',dur:'50m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'Walk · stretch · hip mobility · no gym',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A — Deload',d:'Pull-ups 3×5 @+10kg · Rows 3×8 @16kg · Face pulls 2×15 · Light — deload',dur:'50m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
    {am:{t:'strength',n:'Total Body — Light',d:'Goblet squat 3×8 @26kg · Med ball slams 2×10 · Pallof press 2×10 · Easy session — consolidate, don\'t push',dur:'45m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Easy Run',d:'~4 km Zone 2 · 25 min · deload week, keep it easy',dur:'25m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:3,lbl:'W12',gym:4,sessions:5,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 4×5 @75kg · Box jumps 4×5 · Leg press 4×8 @100kg · Hip thrust 4×8 @87.5kg · Nordic 3×8 · Calf 4×15',dur:'65m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+17.5kg · DB rows 4×8 @22kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 4×30m @20kg/hand',dur:'65m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 4×6 @38kg · Med ball slams 4×15 · Pallof press 4×10 @32kg · Reverse lunge 4×8/side @16kg · Copenhagen plank 4×35s · Finisher: 5 rounds — 10 KB swings @24kg + 5 box jumps + 5 push-ups, 45s rest',dur:'70m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 4×8 @18kg · DB bench 4×8 @18kg · Lat pulldown 4×8 @47.5kg · Rear delt 3×15 · Plate pinch 3×45s',dur:'60m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~5.5 km Zone 2 · 35 min',dur:'35m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:3,lbl:'W13',gym:4,sessions:5,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower B',d:'Front squat 4×5 @52.5kg · Jump squats 4×8 @14kg · Single-leg press 4×8 @62.5kg · Hip thrust 4×6 @95kg · Copenhagen plank 4×30s · Calf 4×15',dur:'65m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+20kg · DB rows 4×8 @23kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 4×30m @21kg/hand',dur:'65m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 4×6 @40kg · Med ball slams 4×15 · Pallof press 4×12 @34kg · Reverse lunge 4×8/side @18kg · Copenhagen plank 4×35s · Finisher: 6 rounds — 10 KB swings @24kg + 5 box jumps + 8 reverse lunges @8kg, 45s rest',dur:'70m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 4×8 @20kg · DB bench 4×8 @19kg · Lat pulldown 4×8 @50kg · Rear delt 3×15 · Plate pinch 3×50s',dur:'60m'},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~5.5 km Zone 2 · 35 min · strong and controlled',dur:'35m'}},
    {am:{t:'rest',n:'Rest',d:'Fencing returns in 2 weeks — summer build almost done 💪',dur:''},pm:null},
  ]},
  {ph:3,lbl:'W14',gym:3,sessions:4,fencing:0,days:[
    {am:{t:'strength',n:'Power Lower A — Transition',d:'Trap bar DL 3×5 @70kg · Box jumps 3×5 · Leg press 3×8 @92.5kg · Hip thrust 3×8 @82.5kg · Calf 3×15 · Volume down — fencing returns next week, stay fresh',dur:'55m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A — Transition',d:'Pull-ups 3×5 @+17.5kg · Rows 3×8 @21kg · Face pulls 3×15 · Wrist curls 3×15',dur:'55m'},pm:null},
    {am:{t:'rest',n:'Active Recovery',d:'',dur:'30m'},pm:null},
    {am:{t:'strength',n:'Total Body Light',d:'Goblet squat 3×8 @36kg · Med ball slams 3×10 · Pallof press 3×10 · Easy session — preparing for full schedule',dur:'50m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Easy Run',d:'~5 km Zone 2 · 30 min · last solo run of summer',dur:'30m'}},
    {am:{t:'rest',n:'Rest',d:'Fencing returns next week — you are stronger than when you left the piste 🔥',dur:''},pm:null},
  ]},
  // ══ PHASE 4: COMPETITION SEASON (W15-22) — FENCING RETURNS ══
  {ph:4,lbl:'W15',gym:3,sessions:7,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 4×5 @67.5kg · Box jumps 3×5 · Leg press 3×10 @92.5kg · Hip thrust 4×8 @82.5kg · Nordic 3×8 · Calf 4×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'Fencing returns — welcome back to the piste',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'First morning session after summer',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+18kg · DB rows 3×8 @22kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 3×30m @21kg/hand',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 3×8 @38kg · Med ball slams 3×12 · Pallof press 3×12 @32kg · Reverse lunge 3×8/side @16kg · Side plank 3×40s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:4,lbl:'W16',gym:3,sessions:7,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 4×5 @72.5kg · Box jumps 4×5 · Leg press 4×8 @97.5kg · Hip thrust 4×8 @87.5kg · Nordic 3×8 · Calf 4×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 4×5 @+20kg · DB rows 4×8 @23kg · Face pulls 3×15 · Wrist curls 4×15 · Farmer carry 4×30m @22kg/hand',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 3×8 @18kg · DB bench 3×8 @19kg · Lat pulldown 3×10 @50kg · Rear delt 3×15 · Plate pinch 3×45s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Easy Run',d:'~4 km Zone 2 · 25 min · easy',dur:'25m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:4,lbl:'W17',gym:3,sessions:7,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower B',d:'Front squat 3×5 @52.5kg · Jump squats 3×8 @14kg · Single-leg press 3×8 @60kg · Hip thrust 4×8 @90kg · Copenhagen plank 3×35s · Calf 3×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 3×5 @+20kg · DB rows 3×8 @23kg · Face pulls 3×15 · Wrist curls 3×15 · Farmer carry 3×30m @22kg/hand',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 3×8 @40kg · Med ball slams 3×12 · Pallof press 3×12 @34kg · Reverse lunge 3×8/side @18kg · Side plank 3×40s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~4 km Zone 2 · 25 min',dur:'25m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:4,lbl:'W18',gym:3,sessions:7,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 3×5 @75kg · Box jumps 3×5 · Leg press 3×10 @100kg · Hip thrust 3×8 @92.5kg · Nordic 3×8 · Calf 3×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 3×8 @20kg · DB bench 3×8 @20kg · Lat pulldown 3×10 @52.5kg · Rear delt 3×15 · Plate pinch 3×50s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 3×5 @+20kg · Rows 3×8 @23kg · Face pulls 3×15 · Wrist curls 3×15 · Farmer carry 3×30m @22kg/hand',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:4,lbl:'W19',gym:2,sessions:4,fencing:3,days:[
    {am:{t:'strength',n:'Power Lower A — Deload',d:'Trap bar DL 3×5 @60kg · Box jumps 2×5 · Leg press 2×10 @80kg · Hip thrust 2×8 @72.5kg · Reduce 20% — deload week',dur:'45m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A — Deload',d:'Pull-ups 2×5 @+15kg · Rows 2×8 @19kg · Face pulls 2×15 · Light',dur:'40m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'Full rest · stretch · recover',dur:''},pm:null},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:4,lbl:'W20',gym:3,sessions:7,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A',d:'Trap bar DL 3×5 @75kg · Box jumps 3×5 · Leg press 3×10 @100kg · Hip thrust 3×8 @90kg · Nordic 3×8 · Calf 3×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 3×5 @+20kg · Rows 3×8 @23kg · Face pulls 3×15 · Wrist curls 3×15 · Farmer carry 3×30m @22kg/hand',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Total Body Athletic',d:'Goblet squat 3×8 @40kg · Med ball slams 3×12 · Pallof press 3×12 @34kg · Reverse lunge 3×8/side @18kg · Side plank 3×40s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:{t:'run',n:'Run',d:'~4 km Zone 2 · 25 min',dur:'25m'}},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:4,lbl:'W21',gym:3,sessions:7,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower B',d:'Front squat 3×5 @55kg · Jump squats 3×8 @14kg · Single-leg press 3×8 @62.5kg · Hip thrust 3×8 @92.5kg · Copenhagen plank 3×35s · Calf 3×15',dur:'60m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper B',d:'DB shoulder press 3×8 @20kg · DB bench 3×8 @20kg · Lat pulldown 3×10 @52.5kg · Rear delt 3×15 · Plate pinch 3×50s',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A',d:'Pull-ups 3×5 @+20kg · Rows 3×8 @23kg · Face pulls 3×15 · Wrist curls 3×15 · Farmer carry 3×30m @22kg/hand',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'',dur:''},pm:null},
  ]},
  {ph:4,lbl:'W22',gym:2,sessions:5,fencing:4,days:[
    {am:{t:'strength',n:'Power Lower A — Final Week',d:'Trap bar DL 3×5 @72.5kg · Box jumps 3×5 · Leg press 3×8 @97.5kg · Hip thrust 3×8 @90kg · Calf 3×15 · Last heavy lower session — you came a long way from Week 1',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'strength',n:'Athletic Upper A — Final Week',d:'Pull-ups 3×5 @+20kg · Rows 3×8 @23kg · Face pulls 3×15 · Wrist curls 3×15 · Last upper session of the program',dur:'55m'},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'fencing',n:'Fencing AM',d:'',dur:'90m'},pm:null},
    {am:{t:'rest',n:'Rest',d:'22 weeks of work. You are not the same athlete who started this program.',dur:''},pm:{t:'fencing',n:'Fencing PM',d:'',dur:'90m'}},
    {am:{t:'yoga',n:'Yoga',d:'End of program yoga · reflect · be proud',dur:'60m'},pm:null},
    {am:{t:'rest',n:'Program Complete 🏆',d:'22 weeks. Done. What an athlete you have become.',dur:''},pm:null},
  ]},
];
