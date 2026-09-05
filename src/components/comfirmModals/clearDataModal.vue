<template>
  <comfirm-modal :id="'clearDataModal'" :title="$t('settings.clearData')" :text="$t('settings.clearDataDetails')"
    :ico="'bi-x-circle'" :okText="$t('settings.clearData')" @on-ok="clearData">
  </comfirm-modal>
</template>
<script>
import comfirmModal from "../../components/comfirmModal.vue";
import exportTool from "../../helpers/exportTool";

export default {
  name: "clearDataModal",
  components: {
    comfirmModal
  },
  methods: {
    clearData: function () {
      const desktopApi = window.weekToDoDesktop;

      if (desktopApi && desktopApi.isElectron) {
        desktopApi.setTrayContextMenuLabel({
          open: "Open",
          quit: "Quit",
        });
        desktopApi.setDarkTrayIcon(false);
      }
      exportTool.clear();
    },
  },
};
</script>