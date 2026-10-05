<!-- FOCUS_EXPERIENCE_20261005_V2 -->
<template>
  <Teleport to="body">
    <FocusDirectoryBrowser
      mode="document"
      :folders="folders"
      :documents="documents"
      :exclude-ids="excludeIds"
      :open-ids="excludeIds"
      :selected-folder-id="
        defaultFolderId === '__root__' ? null : defaultFolderId
      "
      @close="$emit('close')"
      @open-document="pick"
      @create-document="$emit('create', $event)"
    />
  </Teleport>
</template>

<script>
import FocusDirectoryBrowser from "./FocusDirectoryBrowser.vue";

export default {
  name: "FocusColumnInserter",
  components: { FocusDirectoryBrowser },

  props: {
    // 保留原接口，调用方无需继续提供锚点定位逻辑。
    anchor: { type: Object, default: () => ({}) },
    documents: { type: Array, default: () => [] },
    folders: { type: Array, default: () => [] },
    folderPaths: { type: Object, default: () => ({}) },
    excludeIds: { type: Array, default: () => [] },
    defaultFolderId: { default: null },
  },

  emits: ["close", "pick", "create"],

  methods: {
    pick(payload) {
      const id = payload?.id || payload;
      if (!id || this.excludeIds.includes(id)) return;
      this.$emit("pick", id);
    },
  },
};
</script>
