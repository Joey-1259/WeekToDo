import storageRepository from "./storageRepository";

const STORAGE_KEY = "lifeImprint";
const CHANGED_EVENT = "weektodo:life-imprint-changed";
const CURRENT_VERSION = 2;

function createId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function currentYear() {
  return new Date().getFullYear();
}

function yearFromDate(value, fallback) {
  if (!value) return fallback;

  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) ? year : fallback;
}

function normalizeGoal(goal) {
  return {
    id: goal?.id || createId("goal"),
    title: String(goal?.title || ""),
    evidence: String(goal?.evidence || ""),
    firstStep: String(goal?.firstStep || ""),
    done: Boolean(goal?.done),
  };
}

function normalizeCard(card, index) {
  const targetYear =
    Number(card?.targetYear) || currentYear() + 1;

  return {
    id: card?.id || createId("vision"),
    title: String(
      card?.title || `${targetYear} 年的我`
    ),
    targetYear,
    vision: String(card?.vision || ""),
    goals: Array.isArray(card?.goals)
      ? card.goals.map(normalizeGoal)
      : [],
    pinned: Boolean(card?.pinned),
    pinnedAt: card?.pinned
      ? card?.pinnedAt || new Date().toISOString()
      : null,
    sortOrder: Number.isFinite(Number(card?.sortOrder))
      ? Number(card.sortOrder)
      : index,
    createdAt:
      card?.createdAt || new Date().toISOString(),
    updatedAt:
      card?.updatedAt || new Date().toISOString(),
  };
}

function createVisionCard(values = {}) {
  return normalizeCard(
    {
      id: createId("vision"),
      title: values.title || "",
      targetYear:
        values.targetYear || currentYear() + 1,
      vision: values.vision || "",
      goals: values.goals || [],
      pinned: Boolean(values.pinned),
      pinnedAt: values.pinned
        ? new Date().toISOString()
        : null,
      sortOrder: values.sortOrder || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    values.sortOrder || 0
  );
}

function normalizeReviews(reviews) {
  if (!Array.isArray(reviews)) return [];

  return reviews.map((item) => ({
    id: item?.id || createId("review"),
    date:
      item?.date ||
      new Date().toISOString().slice(0, 10),
    title: String(item?.title || ""),
    content: String(item?.content || ""),
  }));
}

function migrateLegacy(value) {
  const year = currentYear();

  const fiveYear = value?.fiveYear || {};
  const oneYear = value?.oneYear || {};

  return {
    version: CURRENT_VERSION,

    cards: [
      createVisionCard({
        title: "5 年后的我",
        targetYear: yearFromDate(
          fiveYear.targetDate,
          year + 5
        ),
        vision: fiveYear.vision || "",
        goals: fiveYear.goals || [],
        pinned: false,
        sortOrder: 0,
      }),

      createVisionCard({
        title: "1 年后的我",
        targetYear: yearFromDate(
          oneYear.targetDate,
          year + 1
        ),
        vision: oneYear.vision || "",
        goals: oneYear.goals || [],
        pinned: false,
        sortOrder: 1,
      }),
    ],

    reviews: normalizeReviews(value?.reviews),

    legacy: {
      motto: String(value?.motto || ""),
      identity: String(value?.identity || ""),
      principles: Array.isArray(value?.principles)
        ? value.principles
        : [],
    },

    updatedAt:
      value?.updatedAt || new Date().toISOString(),
  };
}

function createDefault() {
  const year = currentYear();

  return {
    version: CURRENT_VERSION,

    cards: [
      createVisionCard({
        title: "5 年后的我",
        targetYear: year + 5,
        sortOrder: 0,
      }),

      createVisionCard({
        title: "1 年后的我",
        targetYear: year + 1,
        sortOrder: 1,
      }),
    ],

    reviews: [],
    legacy: {
      motto: "",
      identity: "",
      principles: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalize(value) {
  if (!value) return createDefault();

  if (!Array.isArray(value.cards)) {
    return migrateLegacy(value);
  }

  return {
    version: CURRENT_VERSION,
    cards: value.cards.map(normalizeCard),
    reviews: normalizeReviews(value.reviews),
    legacy: {
      motto: String(value?.legacy?.motto || ""),
      identity: String(value?.legacy?.identity || ""),
      principles: Array.isArray(
        value?.legacy?.principles
      )
        ? value.legacy.principles
        : [],
    },
    updatedAt:
      value.updatedAt || new Date().toISOString(),
  };
}

function notify(value) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(CHANGED_EVENT, {
      detail: value,
    })
  );
}

export default {
  load() {
    const stored = storageRepository.get(STORAGE_KEY);
    const normalized = normalize(stored);

    if (
      !stored ||
      stored.version !== CURRENT_VERSION ||
      !Array.isArray(stored.cards)
    ) {
      storageRepository.set(STORAGE_KEY, normalized);
    }

    return normalized;
  },

  update(value) {
    const normalized = normalize({
      ...value,
      updatedAt: new Date().toISOString(),
    });

    storageRepository.set(STORAGE_KEY, normalized);
    notify(normalized);
    return normalized;
  },

  createCard(values = {}) {
    return createVisionCard(values);
  },

  saveCard(card) {
    const data = this.load();
    const normalized = normalizeCard(
      {
        ...card,
        updatedAt: new Date().toISOString(),
      },
      data.cards.length
    );

    const index = data.cards.findIndex(
      (item) => item.id === normalized.id
    );

    if (index >= 0) {
      normalized.createdAt =
        data.cards[index].createdAt;
      data.cards.splice(index, 1, normalized);
    } else {
      normalized.sortOrder = data.cards.length;
      data.cards.push(normalized);
    }

    return this.update(data);
  },

  removeCard(id) {
    const data = this.load();

    data.cards = data.cards
      .filter((item) => item.id !== id)
      .map((item, index) => ({
        ...item,
        sortOrder: index,
      }));

    return this.update(data);
  },

  togglePin(id) {
    const data = this.load();
    const card = data.cards.find(
      (item) => item.id === id
    );

    if (!card) return data;

    card.pinned = !card.pinned;
    card.pinnedAt = card.pinned
      ? new Date().toISOString()
      : null;

    return this.update(data);
  },
};
