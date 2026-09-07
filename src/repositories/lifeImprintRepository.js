import storageRepository from "./storageRepository";

const STORAGE_KEY = "lifeImprint";
const CHANGED_EVENT = "weektodo:life-imprint-changed";

function createId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function localDateAfterYears(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
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

function normalizeHorizon(value, years) {
  return {
    targetDate:
      value?.targetDate || localDateAfterYears(years),
    vision: String(value?.vision || ""),
    goals: Array.isArray(value?.goals)
      ? value.goals.map(normalizeGoal)
      : [],
  };
}

function createDefault() {
  return {
    motto: "",
    identity: "",
    principles: [
      {
        id: createId("principle"),
        text: "把时间留给真正重要的事情",
      },
    ],
    oneYear: normalizeHorizon({}, 1),
    fiveYear: normalizeHorizon({}, 5),
    reviews: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalize(value) {
  const defaults = createDefault();

  return {
    motto: String(value?.motto || ""),
    identity: String(value?.identity || ""),
    principles: Array.isArray(value?.principles)
      ? value.principles.map((item) => ({
          id: item?.id || createId("principle"),
          text: String(item?.text || ""),
        }))
      : defaults.principles,
    oneYear: normalizeHorizon(value?.oneYear, 1),
    fiveYear: normalizeHorizon(value?.fiveYear, 5),
    reviews: Array.isArray(value?.reviews)
      ? value.reviews.map((item) => ({
          id: item?.id || createId("review"),
          date:
            item?.date ||
            new Date().toISOString().slice(0, 10),
          title: String(item?.title || ""),
          content: String(item?.content || ""),
        }))
      : [],
    updatedAt:
      value?.updatedAt || new Date().toISOString(),
  };
}

export default {
  load() {
    const value = storageRepository.get(STORAGE_KEY);
    return value ? normalize(value) : createDefault();
  },

  update(value) {
    const normalized = normalize({
      ...value,
      updatedAt: new Date().toISOString(),
    });

    storageRepository.set(STORAGE_KEY, normalized);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CHANGED_EVENT, {
          detail: normalized,
        })
      );
    }

    return normalized;
  },
};
