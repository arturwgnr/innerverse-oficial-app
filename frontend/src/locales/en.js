export default {
  common: {
    appName: "Innerverse",
    getStarted: "Get started",
    signIn: "Sign in",
    signOut: "Sign out",
    signUp: "Create account",
    signInWithGoogle: "Sign in with Google",
    email: "Email",
    password: "Password",
    continue: "Continue",
    back: "Back",
    save: "Save",
    cancel: "Cancel",
    send: "Send",
    loading: "Loading...",
    networkError: "Something didn't save, try again.",
    genericError: "Something went wrong, try again.",
  },
  // Branded loading screen (UPDATES.md "Loading screen antes de decidir
  // onboarding vs. app"): shown by RouteGuards.jsx while RequireAuth/
  // RequireOnboarding/RequireNotOnboarded are still deciding where a visitor
  // lands, instead of the generic RouteSkeleton. errorTitle/errorNote/retry
  // only show once the onboarding-status check has exhausted its retries.
  entering: {
    title: "Entering your Innerverse",
    note: "Just a moment while I get your page ready.",
    errorTitle: "Couldn't confirm that yet",
    errorNote: "The connection hiccuped. Nothing was lost, try again when you're ready.",
    retry: "Try again",
  },
  // In-voice, chronicle-style toast copy (UPDATES.md round 4 #2), a handful
  // of variations per event so the same line doesn't repeat every time.
  // Error toasts stay plain (see api.js), only these confirmations get the
  // Oracle's voice.
  toasts: {
    entrySaved: [
      "The Oracle will remember this.",
      "Written down and kept, exactly as you told it.",
      "Filed away in the chronicle.",
      "Kept. Nothing here gets rewritten but you.",
    ],
    fastSaved: [
      "Noted, quick and true.",
      "The Oracle caught that one.",
      "A moment marked down, that's enough for now.",
    ],
    aboutMeCorrectionSent: [
      "Thanks, that reshapes what the Oracle knows about you.",
      "Understood. That's folded into the next reading.",
      "Noted, the mirror adjusts.",
    ],
    profileSaved: ["Saved, the Oracle takes note.", "Kept."],
    passwordChanged: ["Changed, and kept quiet from here on."],
    correctionConfirmed: [
      "Noted as true, the record holds.",
      "Confirmed. The mirror stays clean.",
    ],
    correctionRejected: [
      "Noted, that reading missed.",
      "Struck as written, corrected now.",
    ],
    // Fired once on the first Today load after a sign-in (see Today.jsx),
    // touches on the user's journey rather than a flat "Welcome back".
    loginGreeting: [
      "Welcome back, {name}. The page was left open for you.",
      "Good to see you again, {name}. Pick up wherever you left off.",
      "{name}, the chronicle waited. Ready when you are.",
      "Back again, {name}. Nothing was lost while you were away.",
    ],
    // Save-resilience queue (UPDATES.md round 4 #3): fires when a save fails
    // outright and gets queued, and again once a later retry succeeds.
    entryQueued: [
      "Couldn't reach the Oracle just now. Your words are safe, they'll go through once the line clears.",
      "That one didn't send, but nothing is lost, it's kept and will try again soon.",
    ],
    entryQueueFlushed: [
      "The Oracle finally caught up, an earlier entry just came through.",
      "Connection's back, your held entry is written down now.",
    ],
    analysisDeleted: [
      "Removed. That chapter is gone from the chronicle.",
      "Gone, as asked. What you wrote stays, only that reading of it left.",
      "Struck from the chronicle for good.",
    ],
  },
  // Bottom nav reduced to 4 items plus a center "add" shortcut (EDITS.md
  // round 2 #1, Hick's Law: fewer choices). Calendar and Settings moved
  // behind the hamburger menu instead of competing for bottom nav space.
  nav: {
    home: "Home",
    calendar: "Calendar",
    fast: "Fast",
    addEntry: "New entry",
    analysis: "Analysis",
    aboutMe: "About me",
    stats: "Stats",
    settings: "Settings",
    menu: "Menu",
  },
  landing: {
    nav: {
      linkHowItWorks: "How it works",
      linkFeatures: "Features",
      linkOracle: "The Oracle",
      cta: "Open the app",
    },
    hero: {
      eyebrow: "A quiet place to hear yourself",
      title: "Your inner universe, ",
      titleAccent: "one moment at a time.",
      body: "Innerverse is a journaling app for emotional self-awareness. Answer one honest question a few times a day, by text or voice, and watch the shape of your inner life appear.",
      cta: "Begin your practice",
      secondaryCta: "How it works?",
      badges: ["Private by design", "No streaks, no guilt", "2 minutes a day"],
      // Rotates in the hero's framed preview card (EDITS.md round 2 #2), so
      // it reads like the app already mid-use rather than a static mockup.
      // At least 3 variations each of "yesterday" and "tomorrow", plus the
      // original "today" prompt as the anchor.
      previewLines: [
        { label: "Today", quote: "What do you want today to feel like?" },
        {
          label: "Yesterday",
          quote: "You wrote about feeling steady by evening.",
        },
        {
          label: "Tomorrow",
          quote: "Want to set an intention before it sets one for you?",
        },
        {
          label: "Yesterday",
          quote: "You noticed the afternoon slump again, right on time.",
        },
        {
          label: "Tomorrow",
          quote: "Same time, same honest question, whenever you're ready.",
        },
        {
          label: "Yesterday",
          quote: "Decompress mode caught what the rest of the day didn't.",
        },
        {
          label: "Tomorrow",
          quote: "A clean page. Nothing carries over unless you want it to.",
        },
      ],
    },
    // Simplified (EDITS.md round 2 #2): the body paragraph plus three full
    // sentence-length feature cards was too much text for one 100vh section,
    // shorter body, shorter card copy, same three ideas.
    whyJournaling: {
      eyebrow: "Why journaling works",
      title: "Most of what happens to you never gets looked at twice.",
      titleAccent: "Innerverse is where it finally does.",
      body: "Writing it down does what thinking alone can't, it slows the moment down enough to actually see it.",
      features: [
        {
          icon: "◎",
          title: "Moments, not chores",
          body: "No streaks to protect, no guilt for the days you skip.",
        },
        {
          icon: "◐",
          title: "Fast mode",
          body: "A mood and a few bullets still count as showing up.",
        },
        {
          icon: "◍",
          title: "Patterns, gently told",
          body: "Nothing claimed without your words behind it.",
        },
      ],
    },
    moments: {
      eyebrow: "Four moments, one day",
      title:
        "The day already has a shape. Innerverse just asks you to notice it.",
      moodLegendLabel: "Six ways a moment can feel",
    },
    cleanMirror: {
      eyebrow: "The clean mirror",
      title:
        "Innerverse commits to the truth of what you wrote, regardless of tone.",
      body: "And it's never the last word. When a reflection misses, you can say so, right on the insight. \"That's not it\" is data too, sometimes more useful than being right the first time.",
      body2:
        "Nothing about how it reads you changes without you knowing. It asks first.",
    },
    oracleSection: {
      eyebrow: "A companion that remembers",
      quote:
        "The more you write, the more I see. Not just what happened, but the patterns beneath it.",
      quoteSub:
        "Your words become a map. Over time, I learn the way you think.",
    },
    closing: {
      title: "Start with today. Let the story unfold.",
      body: "Just write. Over time, the pieces begin to connect.",
    },
    footer: {
      tagline: "Built for one, and for however many need it.",
      promise: "Honest, never harsh.",
      exploreHeading: "Explore",
      accountHeading: "Account",
      whyItWorks: "Why it works",
      howItWorks: "How it works",
      oracle: "The Oracle",
      copyright: "Innerverse. All rights reserved.",
      backToTop: "Back to top ↑",
    },
  },
  moments: {
    morning: {
      label: "Morning",
      window: "5am – 12pm",
      tagline: "Set an intention before the day sets one for you.",
    },
    afternoon: {
      label: "Afternoon",
      window: "12pm – 6pm",
      tagline: "A short pause to recalibrate, if you need one.",
    },
    night: {
      label: "Night",
      window: "6pm – 5am",
      tagline: "Close the day honestly, then put it down.",
    },
    decompress: {
      label: "Decompress",
      window: "Anytime",
      tagline: "No structure, no prompt. Just let it out.",
    },
  },
  today: {
    greeting: "Hey {name}.",
    write: "Write",
    fastCardTitle: "Fast mode",
    fastCardBody: "Mood plus what's behind it. Twenty seconds.",
    decompressCardTitle: "Decompress",
    decompressCardBody: "Off the record. Any time you need it.",
    seeWhatIKnow: "See what I know about you",
    seeAnalysis: "Read your chronicle",
    backToArrival: "Back",
    // Two fixed card slots per moment, cycled inside the same carousel as the
    // mindfulness card (EDITS.md round 2 #3: richer, question-form, less
    // empty-feeling than a single flat line). UPDATES.md round 5 #3: each
    // slot now holds several phrasing variants (picked at random per visit,
    // see Today.jsx), kept close in length to the originals, rather than one
    // fixed line each. "knowYou" links to About me, "chronicle" links to
    // Analysis, each slot keeps its own fixed Oracle variant regardless of
    // which line is showing (see Today.jsx).
    oracleLines: {
      morning: {
        knowYou: [
          "What does today need from you, before it starts needing things from you?",
          "Before the day gets loud, what does it already know about you?",
          "What would surprise you least, and most, about how today goes?",
        ],
        chronicle: [
          "Whatever this morning holds, want to name it before it runs off with you?",
          "The morning's still writing itself, want a hand in how it goes?",
          "Something's stirring already, worth naming before it fades?",
        ],
      },
      afternoon: {
        knowYou: [
          "How's the day actually going, compared to how you thought it would?",
          "Is the afternoon confirming something about you, or contradicting it?",
          "What's this stretch of the day quietly telling you about yourself?",
        ],
        chronicle: [
          "Anything from this morning still asking for a second look?",
          "Is there a thread from earlier today still waiting to be picked up?",
          "Something from this morning worth writing down before it's gone?",
        ],
      },
      night: {
        knowYou: [
          "What actually happened today, once you strip away how it's supposed to sound?",
          "What did today reveal about you that this morning didn't know yet?",
          "If today taught you something about yourself, what was it?",
        ],
        chronicle: [
          "What are you ready to finally put down for the night?",
          "Before the day closes, is there a line in it worth keeping?",
          "What's the one true sentence tonight's chapter should end on?",
        ],
      },
      decompress: {
        knowYou: [
          "No structure, no prompt. What's sitting closest to the surface right now?",
          "Off the clock, off the record, what's actually on your mind?",
          "No moment to perform for right now. What's really going on in there?",
        ],
        chronicle: [
          "What would you say if nobody was going to read it but me?",
          "This page doesn't judge. What would you tell it right now?",
          "Nothing here needs a shape yet, what wants to be said anyway?",
        ],
      },
    },
  },
  fastMode: {
    title: "Fast mode",
    subtitle: "Mood and what's behind it. That's it.",
    moodPrompt: "How is this moment sitting with you?",
    reasonsPrompt: "What's contributing to this?",
    reasonsSub: "Pick what applies, optional either way.",
    addReasonPlaceholder: "Add your own",
    addReason: "Add",
    save: "Log it",
    // Kept generic on purpose (UPDATES.md round 3 #5), a starting set the
    // user builds on, not an attempt to cover every possible reason.
    defaultReasons: ["Work", "Sleep", "People", "Health"],
  },
  // Ordered 1-6 scale, low to high (EDITS.md round 2 #1, supersedes UPDATES.md
  // round 3's weather register). Plainer, direct register, still not the
  // literal "happy/sad/angry" cliché the original poetic naming avoided.
  // "Radiant" kept as the top anchor across every naming pass this taxonomy
  // has been through. DB values are just the integer 1-6.
  moods: {
    1: "Overwhelmed",
    2: "Down",
    3: "Unclear",
    4: "Calm",
    5: "Good",
    6: "Radiant",
  },
  // History Mode (UPDATES.md round 3 #2): the whole page is framed as a
  // chronicle being written about the user's life as it happens, not a
  // report. The honesty/correction substance underneath is unchanged, this
  // is presentation only.
  analysis: {
    eyebrow: "History mode",
    title: "The chronicle so far",
    note: "Every entry becomes its own chapter, read honestly. If any of it is wrong, tell me, I'd rather be corrected than confident.",
    chapterMark: "Chapter",
    filterAllMoments: "All moments",
    filterAllMoods: "All moods",
    limitReached:
      "You've reached today's 5 free analyses. The rest of today's entries are still saved, they just won't get a deep read until tomorrow.",
    correctionTrue: "True",
    correctionWrong: "That's not it",
    empty:
      "Nothing here yet. Write an entry and its chapter will show up in this chronicle.",
    pending: "Reading this one now, check back in a moment.",
    failed:
      "This entry couldn't get a deep read this time. It's still saved, nothing was lost.",
    viewEntry: "View entry",
    retryAnalysis: "Try analysis again",
    retrying: "Reading it again...",
    dismiss: "Dismiss",
    deleteConfirmTitle: "Remove this chapter?",
    deleteConfirmBody:
      "The reading disappears from your chronicle for good. What you wrote stays, only this analysis of it goes.",
    deleteConfirmAction: "Remove it",
    deleteConfirmCancel: "Leave it",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    emptyWeek: "Nothing in this week yet.",
    mindfulnessTag: "Mindfulness",
  },
  aboutMe: {
    title: "About me",
    knowledge: "I know {percent}% of you",
    understood: "What I've understood",
    light: "What's already going well",
    dark: "What you might be avoiding",
    correctAll: "Something here is wrong, correct me",
    correctionPlaceholder: "What did it get wrong?",
    awayMessage:
      "You were away {days} days. That's allowed. I kept the page open, nothing else.",
    everyEntry: "Every entry adds light. Nothing is ever taken away.",
    // Replaces the old single fixed closing line (UPDATES.md round 5 #5):
    // {main, sub} pairs, one picked at random per visit, only shown when the
    // user isn't coming back from a gap (see awayMessage/everyEntry above for
    // that case). Hand-written for now, no AI generation yet. The original
    // pairing is kept as the first entry, still in rotation, not discarded.
    closingLines: [
      {
        main: "Here for as long as you keep writing.",
        sub: "Every entry adds light. Nothing is ever taken away.",
      },
      {
        main: "Small entries add up to something real.",
        sub: "You don't have to see the shape yet for it to be forming.",
      },
      {
        main: "Nobody grows by staring at themselves once.",
        sub: "This is what showing up again and again actually looks like.",
      },
      {
        main: "The version of you a year from now is being written today.",
        sub: "One honest sentence at a time.",
      },
      {
        main: "You don't need a good day to show up here.",
        sub: "Some of the truest entries come from the average ones.",
      },
    ],
    history: "Past readings",
    historyEmpty: "No past readings yet, this is the first one.",
    seePastReadings: "See past readings",
    previousReading: "Previous reading",
    nextReading: "Next reading",
  },
  stats: {
    eyebrow: "Stats",
    title: "Your numbers",
    note: "The shape of your habit so far, plainly counted.",
    totalEntries: "Total entries",
    currentStreak: "Day streak",
    moodFrequency: "Mood, how often",
    momentBreakdown: "Moments logged",
    weeklyTrend: "Last 8 weeks",
  },
  settings: {
    eyebrow: "Settings",
    title: "Your account",
    profileHeading: "Profile",
    email: "Email",
    passwordHeading: "Password",
    currentPassword: "Current password",
    newPassword: "New password",
    changePassword: "Change password",
    preferencesHeading: "Preferences",
    language: "Language",
  },
  onboarding: {
    preferredName: "What should I call you?",
    preferredNameHelp:
      "A name or nickname, whatever feels right. I'll use it wherever it fits.",
    birthDate: "When were you born?",
    birthDateHelp:
      "This helps me understand context like life stage, never estimated.",
    // Restored (EDITS.md round 3, exact copy given), round 2 had dropped it.
    finalQuestion: "No judgment: what's your biggest life goal right now?",
    finalQuestionHelp:
      "There's no wrong answer, and you can change it whenever. I'll hold you to it kindly.",
  },
};
