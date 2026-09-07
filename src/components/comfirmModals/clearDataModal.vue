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
    clearData: async function () {
      const desktopApi = window.weekToDoDesktop;

      if (desktopApi && desktopApi.isElectron) {
        desktopApi.setTrayContextMenuLabel({
          open: "Open",
          quit: "Quit",
        });
        desktopApi.setDarkTrayIcon(false);
      }
      try {
        await exportTool.clear();
      } catch (error) {
        console.error("清除全部数据失败：", error);
        window.alert(
          error?.message ||
            "清除数据失败，请重启应用后重试。"
        );
      }
    },
  },
};
</script>