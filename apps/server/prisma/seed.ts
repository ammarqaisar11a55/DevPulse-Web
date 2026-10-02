/**
 * Development/demo seed data. Creates two demo accounts (flagged `isDemo`) with ~90 days of
 * realistic coding activity so every dashboard and chart has something to show.
 *
 * Safe to re-run: existing demo accounts are deleted and recreated. Real accounts are never
 * touched. Refuses to run with NODE_ENV=production unless SEED_ALLOW_PRODUCTION=true.
 *
 *   npm run db:seed
 */
import { randomBytes, createHash } from 'node:crypto';
import { PrismaClient, type ActivityEventType, type Prisma } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

export const DEMO_PASSWORD = 'devpulse-demo-1';
const DAYS_OF_HISTORY = 90;
const MINUTE = 60_000;

// ─── Deterministic randomness ────────────────────────────────────────────────

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let random = mulberry32(42);
const between = (min: number, max: number) => min + random() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const chance = (probability: number) => random() < probability;
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}
function weighted<T>(items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1]!.value;
}

// ─── Time zone helpers (local wall-clock → UTC) ──────────────────────────────

function offsetMs(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  const asUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** UTC instant for a local wall-clock time `daysAgo` days before today in `timeZone`. */
function localTime(daysAgo: number, minutesIntoDay: number, timeZone: string) {
  const now = new Date();
  const todayLocal = new Date(now.getTime() + offsetMs(now, timeZone));
  const midnightLocalAsUtc = Date.UTC(
    todayLocal.getUTCFullYear(),
    todayLocal.getUTCMonth(),
    todayLocal.getUTCDate() - daysAgo,
  );
  const guess = midnightLocalAsUtc + minutesIntoDay * MINUTE;
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

// ─── Demo content ────────────────────────────────────────────────────────────

interface ProjectSpec {
  name: string;
  slug: string;
  description: string;
  repositoryUrl: string | null;
  repositoryProvider: 'GITHUB' | 'GITLAB' | null;
  primaryLanguage: string;
  color: string;
  languages: { value: string; weight: number }[];
  branches: string[];
  titles: string[];
  weight: number;
  archived?: boolean;
}

const PROJECTS: ProjectSpec[] = [
  {
    name: 'Notes Saver',
    slug: 'notes-saver',
    description: 'Offline-first notes app with end-to-end encrypted sync.',
    repositoryUrl: 'https://github.com/devpulse-demo/notes-saver',
    repositoryProvider: 'GITHUB',
    primaryLanguage: 'typescript',
    color: 'blue',
    languages: [
      { value: 'typescript', weight: 7 },
      { value: 'css', weight: 2 },
      { value: 'json', weight: 1 },
    ],
    branches: ['main', 'feature/sync-engine', 'fix/editor-cursor', 'feature/tags'],
    titles: [
      'Worked on authentication',
      'Sync conflict resolution',
      'Editor toolbar',
      'Offline cache',
      'Tag filtering',
    ],
    weight: 5,
  },
  {
    name: 'PortPilot',
    slug: 'portpilot',
    description: 'CLI for managing local development ports and proxies.',
    repositoryUrl: 'https://github.com/devpulse-demo/portpilot',
    repositoryProvider: 'GITHUB',
    primaryLanguage: 'typescript',
    color: 'teal',
    languages: [
      { value: 'typescript', weight: 8 },
      { value: 'shellscript', weight: 1 },
      { value: 'markdown', weight: 1 },
    ],
    branches: ['main', 'feature/api-routes', 'chore/deps'],
    titles: [
      'Worked on API routes',
      'Port conflict detection',
      'CLI help output',
      'Proxy configuration',
    ],
    weight: 3,
  },
  {
    name: 'DevPulse',
    slug: 'devpulse',
    description: 'Coding analytics dashboard and VS Code extension.',
    repositoryUrl: 'https://github.com/devpulse-demo/devpulse',
    repositoryProvider: 'GITHUB',
    primaryLanguage: 'typescript',
    color: 'violet',
    languages: [
      { value: 'typescript', weight: 6 },
      { value: 'typescriptreact', weight: 3 },
      { value: 'prisma', weight: 1 },
    ],
    branches: ['main', 'feature/dashboard', 'feature/pairing'],
    titles: ['Worked on dashboard', 'Pairing flow', 'Analytics queries', 'Theme tokens'],
    weight: 3,
  },
  {
    name: 'Ray Tracer',
    slug: 'ray-tracer',
    description: 'Weekend path tracer with BVH acceleration.',
    repositoryUrl: 'https://gitlab.com/devpulse-demo/ray-tracer',
    repositoryProvider: 'GITLAB',
    primaryLanguage: 'cpp',
    color: 'amber',
    languages: [
      { value: 'cpp', weight: 9 },
      { value: 'cmake', weight: 1 },
    ],
    branches: ['main', 'bvh', 'materials'],
    titles: ['BVH construction', 'Dielectric materials', 'Denoising pass', 'Profiling'],
    weight: 2,
  },
  {
    name: 'Data Pipeline',
    slug: 'data-pipeline',
    description: 'Nightly ETL jobs for the analytics warehouse.',
    repositoryUrl: null,
    repositoryProvider: null,
    primaryLanguage: 'python',
    color: 'magenta',
    languages: [
      { value: 'python', weight: 8 },
      { value: 'sql', weight: 2 },
    ],
    branches: ['main'],
    titles: ['Schema migration', 'Backfill job', 'Data validation'],
    weight: 1,
    archived: true,
  },
];

const EDITOR_EVENTS: ActivityEventType[] = [
  'FILE_OPENED',
  'FILE_CHANGED',
  'FILE_CHANGED',
  'FILE_CHANGED',
];
const FILE_EXTENSIONS: Record<string, string> = {
  typescript: '.ts',
  typescriptreact: '.tsx',
  css: '.css',
  json: '.json',
  shellscript: '.sh',
  markdown: '.md',
  prisma: '.prisma',
  cpp: '.cpp',
  cmake: '.cmake',
  python: '.py',
  sql: '.sql',
};

interface DemoUserSpec {
  email: string;
  username: string;
  fullName: string;
  bio: string;
  timezone: string;
  intensity: number;
  projects: ProjectSpec[];
}

const DEMO_USERS: DemoUserSpec[] = [
  {
    email: 'demo@devpulse.dev',
    username: 'demo',
    fullName: 'Sam Carter',
    bio: 'Full-stack developer. TypeScript by day, C++ ray tracing by weekend.',
    timezone: 'Asia/Karachi',
    intensity: 1,
    projects: PROJECTS,
  },
  {
    email: 'jordan@devpulse.dev',
    username: 'jordan',
    fullName: 'Jordan Lee',
    bio: 'Backend engineer.',
    timezone: 'Europe/London',
    intensity: 0.6,
    projects: [PROJECTS[1]!, PROJECTS[4]!],
  },
];

/**
 * Extra opted-in accounts with a few weeks of manually logged time and nothing else, so the
 * leaderboard shows a realistic field in development. Removed with the other demo accounts.
 */
const LEADERBOARD_PARTICIPANTS: { name: string; username: string; activity: number }[] = [
  { name: 'Priya Raman', username: 'priya', activity: 0.95 },
  { name: 'Mateo Alvarez', username: 'mateo', activity: 0.85 },
  { name: 'Aiko Tanaka', username: 'aiko', activity: 0.8 },
  { name: 'Noah Fischer', username: 'noah', activity: 0.7 },
  { name: 'Zara Okafor', username: 'zara', activity: 0.6 },
  { name: "Liam O'Connor", username: 'liam', activity: 0.5 },
  { name: 'Hana Kim', username: 'hana', activity: 0.45 },
  { name: 'Omar Haddad', username: 'omar', activity: 0.35 },
  { name: 'Elena Petrova', username: 'elena', activity: 0.25 },
  { name: 'Lucas Martin', username: 'lucas', activity: 0.15 },
];
const PARTICIPANT_DAYS = 35;

async function seedLeaderboardParticipants(passwordHash: string) {
  for (const participant of LEADERBOARD_PARTICIPANTS) {
    const user = await prisma.user.create({
      data: {
        email: `${participant.username}@devpulse.dev`,
        username: participant.username,
        fullName: participant.name,
        passwordHash,
        isDemo: true,
        createdAt: localTime(PARTICIPANT_DAYS + 5, 600, 'UTC'),
        settings: { create: { showOnLeaderboard: true } },
      },
    });
    const sessions: Prisma.CodingSessionCreateManyInput[] = [];
    // Today is included so the daily board has entries too.
    for (let daysAgo = PARTICIPANT_DAYS; daysAgo >= 0; daysAgo -= 1) {
      if (random() > participant.activity) continue;
      const activeMinutes = 30 + Math.floor(random() * 150 * participant.activity + 30);
      const idleMinutes = Math.floor(random() * 20);
      const durationSeconds = (activeMinutes + idleMinutes) * 60;
      // Today's session must already have ended.
      const startMinute = daysAgo === 0 ? 30 : 480 + Math.floor(random() * 600);
      const startedAt = localTime(daysAgo, startMinute, 'UTC');
      const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
      if (endedAt > new Date()) continue;
      sessions.push({
        userId: user.id,
        source: 'MANUAL',
        status: 'ENDED',
        startedAt,
        endedAt,
        durationSeconds,
        activeSeconds: activeMinutes * 60,
        idleSeconds: idleMinutes * 60,
        language: pick(['typescript', 'python', 'go', 'rust', 'java']),
      });
    }
    await prisma.codingSession.createMany({ data: sessions });
  }
  return LEADERBOARD_PARTICIPANTS.length;
}

/** Stand-in credential hash; demo devices cannot actually authenticate. */
function fakeCredential() {
  const token = `dpd_${randomBytes(24).toString('base64url')}`;
  return {
    credentialHash: createHash('sha256').update(token).digest('hex'),
    credentialPrefix: token.slice(0, 12),
  };
}

async function seedUser(spec: DemoUserSpec, passwordHash: string) {
  const user = await prisma.user.create({
    data: {
      email: spec.email,
      username: spec.username,
      fullName: spec.fullName,
      bio: spec.bio,
      timezone: spec.timezone,
      passwordHash,
      isDemo: true,
      createdAt: localTime(DAYS_OF_HISTORY + 5, 600, spec.timezone),
      // Demo accounts opt in so the leaderboard has entries in development.
      settings: { create: { theme: 'SYSTEM', weekStartsOn: 1, showOnLeaderboard: true } },
    },
  });

  const projects = [];
  for (const [index, project] of spec.projects.entries()) {
    projects.push({
      spec: project,
      row: await prisma.project.create({
        data: {
          userId: user.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
          repositoryUrl: project.repositoryUrl,
          repositoryProvider: project.repositoryProvider,
          primaryLanguage: project.primaryLanguage,
          color: project.color,
          archivedAt: project.archived ? localTime(20, 600, spec.timezone) : null,
          createdAt: localTime(DAYS_OF_HISTORY + 2 - index, 540, spec.timezone),
        },
      }),
    });
  }

  const devices = [
    await prisma.device.create({
      data: {
        userId: user.id,
        name: 'Ubuntu Laptop',
        platform: 'linux',
        editor: 'vscode',
        editorVersion: '1.104.0',
        extensionVersion: '0.1.0',
        createdAt: localTime(DAYS_OF_HISTORY, 540, spec.timezone),
        ...fakeCredential(),
      },
    }),
    await prisma.device.create({
      data: {
        userId: user.id,
        name: 'Desktop PC',
        platform: 'win32',
        editor: 'vscode',
        editorVersion: '1.104.0',
        extensionVersion: '0.1.0',
        createdAt: localTime(60, 540, spec.timezone),
        ...fakeCredential(),
      },
    }),
    await prisma.device.create({
      data: {
        userId: user.id,
        name: 'Old MacBook',
        platform: 'darwin',
        editor: 'vscode',
        extensionVersion: '0.0.9',
        createdAt: localTime(DAYS_OF_HISTORY, 600, spec.timezone),
        revokedAt: localTime(45, 700, spec.timezone),
        ...fakeCredential(),
      },
    }),
  ];

  const activeProjects = projects.filter((project) => !project.spec.archived);
  const sessions: Prisma.CodingSessionCreateManyInput[] = [];
  const languages: Prisma.SessionLanguageCreateManyInput[] = [];
  const events: Prisma.ActivityEventCreateManyInput[] = [];
  const now = Date.now();

  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = localTime(daysAgo, 0, spec.timezone);
    const weekday = new Date(dayStart.getTime() + offsetMs(dayStart, spec.timezone)).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    if (!chance((weekend ? 0.45 : 0.92) * spec.intensity + (1 - spec.intensity) * 0.2)) continue;

    // Morning, late-morning, afternoon and evening blocks, some skipped.
    const slots: [number, number][] = [
      [8 * 60 + 30, 10 * 60 + 30],
      [11 * 60, 12 * 60 + 30],
      [14 * 60, 17 * 60 + 30],
      [20 * 60, 23 * 60],
    ];
    let cursor = 0;
    for (const [slotStart, slotEnd] of slots) {
      if (!chance(weekend ? 0.5 : 0.85)) continue;
      const startMinute = Math.max(cursor + 10, intBetween(slotStart, slotEnd - 30));
      const durationMinutes = Math.min(intBetween(40, 170), slotEnd + 90 - startMinute);
      if (durationMinutes < 15) continue;
      cursor = startMinute + durationMinutes;

      const startedAt = localTime(daysAgo, startMinute, spec.timezone);
      const endedAt = new Date(startedAt.getTime() + durationMinutes * MINUTE);
      if (endedAt.getTime() > now - 5 * MINUTE) continue; // Only finished sessions; nothing "live".

      // Archived project only has history from before it was archived.
      const pool = daysAgo > 25 ? projects : activeProjects;
      const project = weighted(pool.map((entry) => ({ value: entry, weight: entry.spec.weight })));
      const device =
        daysAgo > 45 && chance(0.2) ? devices[2]! : chance(0.7) ? devices[0]! : devices[1]!;

      const durationSeconds = durationMinutes * 60;
      const activeSeconds = Math.round(durationSeconds * between(0.62, 0.96));
      const id = crypto.randomUUID();

      // Split active time across two or three languages.
      const primary = weighted(project.spec.languages);
      const split = new Map<string, number>([[primary, activeSeconds]]);
      if (project.spec.languages.length > 1 && chance(0.6)) {
        const secondary = pick(
          project.spec.languages.filter((language) => language.value !== primary),
        ).value;
        const share = Math.round(activeSeconds * between(0.1, 0.3));
        split.set(primary, activeSeconds - share);
        split.set(secondary, share);
      }
      for (const [language, seconds] of split)
        languages.push({ sessionId: id, language, activeSeconds: seconds });

      const commits = chance(0.55) ? intBetween(1, 4) : 0;
      const linesAdded = intBetween(10, 40) * Math.ceil(durationMinutes / 20);
      sessions.push({
        id,
        userId: user.id,
        projectId: project.row.id,
        deviceId: device.id,
        clientSessionId: `seed-${id}`,
        source: 'EXTENSION',
        status: 'ENDED',
        title: chance(0.8) ? pick(project.spec.titles) : null,
        startedAt,
        endedAt,
        lastHeartbeatAt: endedAt,
        durationSeconds,
        activeSeconds,
        idleSeconds: durationSeconds - activeSeconds,
        language: primary,
        repository: project.spec.repositoryUrl?.replace(/^https:\/\//, '') ?? project.spec.slug,
        branch: pick(project.spec.branches),
        editor: 'vscode',
        filesChanged: intBetween(1, 14),
        linesAdded,
        linesRemoved: Math.round(linesAdded * between(0.1, 0.6)),
        commits,
        createdAt: endedAt,
      });

      // Detailed event streams for the last two weeks only.
      if (daysAgo <= 14) {
        const base = {
          userId: user.id,
          deviceId: device.id,
          projectId: project.row.id,
          sessionId: id,
        };
        events.push({ ...base, type: 'SESSION_STARTED', occurredAt: startedAt, language: primary });
        for (let index = 0; index < intBetween(4, 12); index += 1) {
          const type = pick(EDITOR_EVENTS);
          const language = pick([...split.keys()]);
          events.push({
            ...base,
            type,
            occurredAt: new Date(startedAt.getTime() + random() * durationSeconds * 1000),
            language,
            metadata:
              type === 'FILE_CHANGED'
                ? { fileExtension: FILE_EXTENSIONS[language] ?? '', linesAdded: intBetween(1, 30) }
                : { fileExtension: FILE_EXTENSIONS[language] ?? '' },
          });
        }
        if (durationSeconds - activeSeconds > 300) {
          const idleAt = new Date(startedAt.getTime() + durationSeconds * 500);
          events.push({ ...base, type: 'IDLE_STARTED', occurredAt: idleAt });
          events.push({
            ...base,
            type: 'IDLE_ENDED',
            occurredAt: new Date(idleAt.getTime() + (durationSeconds - activeSeconds) * 1000),
            metadata: { idleSeconds: durationSeconds - activeSeconds },
          });
        }
        for (let index = 0; index < commits; index += 1) {
          events.push({
            ...base,
            type: 'GIT_COMMIT',
            occurredAt: new Date(startedAt.getTime() + random() * durationSeconds * 1000),
            metadata: { commitCount: 1 },
          });
        }
        events.push({ ...base, type: 'SESSION_ENDED', occurredAt: endedAt });
      }
    }
  }

  await prisma.codingSession.createMany({ data: sessions });
  await prisma.sessionLanguage.createMany({ data: languages });
  await prisma.activityEvent.createMany({ data: events });

  // Last activity per project and last-seen per device from the generated history.
  for (const project of projects) {
    const last = await prisma.codingSession.findFirst({
      where: { projectId: project.row.id },
      orderBy: { endedAt: 'desc' },
      select: { endedAt: true },
    });
    await prisma.project.update({
      where: { id: project.row.id },
      data: { lastActivityAt: last?.endedAt ?? null },
    });
  }
  for (const device of devices) {
    const last = await prisma.codingSession.findFirst({
      where: { deviceId: device.id },
      orderBy: { endedAt: 'desc' },
      select: { endedAt: true },
    });
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: last?.endedAt ?? null },
    });
  }

  await prisma.goal.createMany({
    data: [
      {
        userId: user.id,
        metric: 'CODING_TIME',
        period: 'WEEKLY',
        target: 25 * 3600,
        title: 'Weekly coding time',
      },
      {
        userId: user.id,
        metric: 'CODING_TIME',
        period: 'DAILY',
        target: 4 * 3600,
        title: 'Daily focus',
      },
      {
        userId: user.id,
        metric: 'SESSIONS',
        period: 'MONTHLY',
        target: 90,
        title: 'Monthly sessions',
      },
      ...(activeProjects[0]
        ? [
            {
              userId: user.id,
              projectId: activeProjects[0].row.id,
              metric: 'CODING_TIME' as const,
              period: 'WEEKLY' as const,
              target: 12 * 3600,
              title: `${activeProjects[0].spec.name} this week`,
            },
          ]
        : []),
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: 'DEVICE_CONNECTED',
        title: 'New device connected',
        body: 'Desktop PC was paired with your account.',
        link: '/devices',
        createdAt: localTime(60, 541, spec.timezone),
        readAt: localTime(60, 600, spec.timezone),
      },
      {
        userId: user.id,
        type: 'DEVICE_REVOKED',
        title: 'Device access revoked',
        body: 'Old MacBook can no longer sync activity.',
        link: '/devices',
        createdAt: localTime(45, 700, spec.timezone),
        readAt: localTime(45, 710, spec.timezone),
      },
      {
        userId: user.id,
        type: 'GOAL_COMPLETED',
        title: 'Weekly goal reached',
        body: 'You hit 25 hours of coding last week.',
        link: '/goals',
        createdAt: localTime(3, 1200, spec.timezone),
      },
      {
        userId: user.id,
        type: 'GOAL_PROGRESS',
        title: 'Weekly goal 80% complete',
        body: 'Keep going: about 5 hours to go this week.',
        link: '/goals',
        createdAt: localTime(0, 30, spec.timezone),
      },
    ],
  });

  return { user: spec.email, sessions: sessions.length, events: events.length };
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'Refusing to seed demo data in production. Set SEED_ALLOW_PRODUCTION=true to override.',
    );
  }
  random = mulberry32(42);

  const removed = await prisma.user.deleteMany({ where: { isDemo: true } });
  if (removed.count > 0) console.log(`Removed ${removed.count} existing demo account(s).`);

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  for (const spec of DEMO_USERS) {
    const summary = await seedUser(spec, passwordHash);
    console.log(`Seeded ${summary.user}: ${summary.sessions} sessions, ${summary.events} events.`);
  }
  const participants = await seedLeaderboardParticipants(passwordHash);
  console.log(`Seeded ${participants} leaderboard participants.`);
  console.log(`\nDemo sign-in: demo@devpulse.dev (or "demo") / ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
