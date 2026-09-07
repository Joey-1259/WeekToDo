import { Modal, Toast } from "bootstrap";
import dataBackupService from "../services/dataBackupService";

function getModal(id) {
  const element = document.getElementById(id);

  return element
    ? Modal.getInstance(element)
    : null;
}

function hideModal(id) {
  const modal = getModal(id);

  if (modal) {
    modal.hide();
  }
}

function showInvalidFileToast(message) {
  console.error("[data-center]", message);

  const element =
    document.getElementById("invalidFile");

  if (element) {
    Toast.getOrCreateInstance(element).show();
  }
}

export default {
  async export() {
    try {
      return await dataBackupService.exportBackup();
    } catch (error) {
      showInvalidFileToast(
        error?.message || "完整备份导出失败"
      );
      throw error;
    } finally {
      hideModal("exportingModal");
    }
  },

  async import(event) {
    const input = event?.target;
    const file = input?.files?.[0];

    try {
      if (!file) return null;

      const result =
        await dataBackupService.importBackup(file);

      window.setTimeout(() => {
        window.location.reload();
      }, 300);

      return result;
    } catch (error) {
      showInvalidFileToast(
        error?.message || "完整备份导入失败"
      );
      throw error;
    } finally {
      if (input) input.value = "";
      hideModal("importingModal");
    }
  },

  async clear() {
    try {
      const desktopApi =
        window.weekToDoDesktop;

      if (
        desktopApi &&
        desktopApi.isElectron &&
        desktopApi.clearMainConfig
      ) {
        desktopApi.clearMainConfig();
      }

      await dataBackupService.clearAll();
      window.location.reload();
    } catch (error) {
      showInvalidFileToast(
        error?.message || "清除数据失败"
      );
      throw error;
    }
  },
};
