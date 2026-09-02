export default {
  getDefaultTags(vue) {
    return [
      { id: "tag_work", name: vue.$t("taskTags.work"), color: "#4263eb" },
      { id: "tag_life", name: vue.$t("taskTags.life"), color: "#40c057" },
      { id: "tag_study", name: vue.$t("taskTags.study"), color: "#f59f00" },
      { id: "tag_health", name: vue.$t("taskTags.health"), color: "#f06595" },
      { id: "tag_urgent", name: vue.$t("taskTags.urgent"), color: "#fa5252" },
    ];
  },
};
