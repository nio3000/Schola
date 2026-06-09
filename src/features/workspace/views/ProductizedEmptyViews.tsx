/**
 * Artifact / Plugin Productized Empty Views — Phase 5-UX-POST-BRANCH-CLOSE-BATCH.
 *
 * Preview-only, no real export, no Vault write, no plugin runtime, no Marketplace.
 */
import type { ReactElement } from 'react';

export function ArtifactEmptyView(): ReactElement {
  return (
    <div className="workspace-empty-view" data-testid="artifact-empty-view">
      <div className="workspace-empty-view-content">
        <h2>Artifacts</h2>
        <p>Artifact 草稿将在此显示。</p>
        <p>运行 AI Research 任务后，生成的草稿会出现在这里。</p>

        <div className="workspace-empty-view-actions">
          <button type="button" className="workspace-empty-view-btn" disabled data-testid="artifact-export-btn">
            导出
          </button>
          <button type="button" className="workspace-empty-view-btn" disabled data-testid="artifact-save-btn">
            保存到 Vault
          </button>
        </div>

        <p className="workspace-empty-view-note">导出与保存功能将在后续完成。</p>
      </div>
    </div>
  );
}

export function PluginPreviewOnlyView(): ReactElement {
  return (
    <div className="workspace-empty-view" data-testid="plugin-preview-view">
      <div className="workspace-empty-view-content">
        <h2>Plugin Ecosystem</h2>
        <p>插件生态尚未开放。</p>
        <p>Schola 插件系统将在后续完成。当前为只读预览。</p>

        <div className="workspace-empty-view-cards">
          <div className="workspace-empty-view-card">
            <strong>官方模块</strong>
            <p>PPT-master · Enhanced Paper Import · Courseware Export</p>
          </div>
          <div className="workspace-empty-view-card">
            <strong>未来扩展</strong>
            <p>第三方插件市场 · 社区扩展 · 自定义工作流</p>
          </div>
          <div className="workspace-empty-view-card">
            <strong>权限预览</strong>
            <p>所有插件需用户授权。不自动读取 Vault。不自动发送数据。</p>
          </div>
        </div>

        <p className="workspace-empty-view-note">插件生态尚未开放。不安装/卸载/启用/禁用插件。不引入 Extension Host。</p>
      </div>
    </div>
  );
}
