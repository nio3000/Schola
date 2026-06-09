import { useState, type ChangeEvent, type ReactElement } from 'react';
import type { GraphStyleConfig, NodeShape } from '../lib/graphTypes';
import { DEFAULT_STYLE_CONFIG } from '../lib/graphTypes';

interface GraphStylePanelProps {
  readonly styleConfig: GraphStyleConfig;
  readonly onChange: (config: GraphStyleConfig) => void;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

type StyleCategory = 'all-nodes' | 'all-edges' | 'selected-node' | 'file-node' | 'unresolved-node';
type LabelDensity = 'compact' | 'balanced' | 'dense';
type TruncationMode = 'short' | 'medium' | 'long';

const NODE_SHAPE_LABELS: Record<NodeShape, string> = {
  circle: '圆形',
  rectangle: '矩形',
  'rounded-rectangle': '圆角矩形',
  capsule: '胶囊',
  hexagon: '六边形',
  diamond: '菱形',
};

export function GraphStylePanel({
  styleConfig,
  onChange,
  isOpen,
  onClose,
}: GraphStylePanelProps): ReactElement | null {
  const [category, setCategory] = useState<StyleCategory>('all-nodes');
  const [density, setDensity] = useState<LabelDensity>('balanced');
  const [truncation, setTruncation] = useState<TruncationMode>('medium');
  const [relationVisibility, setRelationVisibility] = useState<'highlight' | 'always'>('highlight');

  if (!isOpen) return null;

  const updateStyle = (patch: Partial<GraphStyleConfig>): void => {
    onChange({ ...styleConfig, ...patch });
  };

  const handleNumberChange =
    (key: 'nodeSize' | 'edgeWidth' | 'labelFontSize') =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      updateStyle({ [key]: Number(event.target.value) });
    };

  const highContrastEnabled =
    styleConfig.canvasBackground === '#080B12' && styleConfig.nodeColor === '#F8D866';

  return (
    <aside className="graph-style-panel" data-testid="graph-style-panel" aria-label="图谱样式设置">
      <div className="graph-style-panel-header">
        <div>
          <p className="graph-style-panel-kicker">Graph Style</p>
          <h3 className="graph-style-panel-title">图谱视觉设置</h3>
        </div>
        <button type="button" className="graph-style-panel-close" onClick={onClose} aria-label="关闭样式面板">
          关闭
        </button>
      </div>

      <div className="graph-style-panel-body schola-scrollbar">
        <section className="graph-style-section">
          <label className="graph-style-label" htmlFor="graph-style-category">
            分类
          </label>
          <select
            id="graph-style-category"
            className="graph-style-select"
            value={category}
            onChange={(event) => setCategory(event.target.value as StyleCategory)}
          >
            <option value="all-nodes">All Nodes</option>
            <option value="all-edges">All Edges</option>
            <option value="selected-node">Selected Node</option>
            <option value="file-node">specific node type: file</option>
            <option value="unresolved-node">specific node type: unresolved</option>
          </select>
        </section>

        <section className="graph-style-section">
          <h4 className="graph-style-section-title">颜色</h4>
          <label className="graph-style-row">
            <span>节点颜色</span>
            <input
              className="graph-color-input"
              type="color"
              value={styleConfig.nodeColor}
              onChange={(event) => updateStyle({ nodeColor: event.target.value })}
            />
          </label>
          <label className="graph-style-row">
            <span>边颜色</span>
            <input
              className="graph-color-input"
              type="color"
              value={styleConfig.edgeColor}
              onChange={(event) => updateStyle({ edgeColor: event.target.value })}
            />
          </label>
          <label className="graph-style-checkbox">
            <input
              type="checkbox"
              checked={styleConfig.nodeColor === DEFAULT_STYLE_CONFIG.nodeColor}
              onChange={(event) =>
                updateStyle(
                  event.target.checked
                    ? {
                        nodeColor: DEFAULT_STYLE_CONFIG.nodeColor,
                        edgeColor: DEFAULT_STYLE_CONFIG.edgeColor,
                        labelColor: DEFAULT_STYLE_CONFIG.labelColor,
                        relationLabelColor: DEFAULT_STYLE_CONFIG.relationLabelColor,
                        canvasBackground: DEFAULT_STYLE_CONFIG.canvasBackground,
                      }
                    : { nodeColor: '#2F6F73', edgeColor: '#9A5C1F' },
                )
              }
            />
            <span>主题预设</span>
          </label>
        </section>

        <section className="graph-style-section">
          <h4 className="graph-style-section-title">尺寸</h4>
          <label className="graph-style-slider">
            <span>节点大小 {styleConfig.nodeSize}</span>
            <input type="range" min="1" max="7" value={styleConfig.nodeSize} onChange={handleNumberChange('nodeSize')} />
          </label>
          <label className="graph-style-slider">
            <span>边宽度 {styleConfig.edgeWidth}</span>
            <input type="range" min="1" max="7" value={styleConfig.edgeWidth} onChange={handleNumberChange('edgeWidth')} />
          </label>
          <label className="graph-style-label" htmlFor="graph-node-shape">
            节点形状
          </label>
          <select
            id="graph-node-shape"
            className="graph-style-select"
            value={styleConfig.nodeShape}
            onChange={(event) => updateStyle({ nodeShape: event.target.value as NodeShape })}
          >
            {Object.entries(NODE_SHAPE_LABELS).map(([shape, label]) => (
              <option key={shape} value={shape}>
                {label}
              </option>
            ))}
          </select>
        </section>

        <section className="graph-style-section">
          <h4 className="graph-style-section-title">标签</h4>
          <label className="graph-style-checkbox">
            <input
              type="checkbox"
              checked={styleConfig.showLabels}
              onChange={(event) => updateStyle({ showLabels: event.target.checked })}
            />
            <span>显示节点标签</span>
          </label>
          <label className="graph-style-row">
            <span>标签颜色</span>
            <input
              className="graph-color-input"
              type="color"
              value={styleConfig.labelColor}
              onChange={(event) => updateStyle({ labelColor: event.target.value })}
            />
          </label>
          <label className="graph-style-slider">
            <span>字号 {styleConfig.labelFontSize}</span>
            <input type="range" min="9" max="18" value={styleConfig.labelFontSize} onChange={handleNumberChange('labelFontSize')} />
          </label>
          <label className="graph-style-label" htmlFor="graph-label-density">
            密度
          </label>
          <select
            id="graph-label-density"
            className="graph-style-select"
            value={density}
            onChange={(event) => setDensity(event.target.value as LabelDensity)}
          >
            <option value="compact">低密度</option>
            <option value="balanced">平衡</option>
            <option value="dense">高密度</option>
          </select>
          <label className="graph-style-label" htmlFor="graph-title-truncation">
            标题截断
          </label>
          <select
            id="graph-title-truncation"
            className="graph-style-select"
            value={truncation}
            onChange={(event) => setTruncation(event.target.value as TruncationMode)}
          >
            <option value="short">短标题</option>
            <option value="medium">中等标题</option>
            <option value="long">长标题</option>
          </select>
        </section>

        <section className="graph-style-section">
          <h4 className="graph-style-section-title">关系名称</h4>
          <label className="graph-style-checkbox">
            <input
              type="checkbox"
              checked={styleConfig.showRelationLabels}
              onChange={(event) => updateStyle({ showRelationLabels: event.target.checked })}
            />
            <span>显示关系名称</span>
          </label>
          <label className="graph-style-row">
            <span>关系颜色</span>
            <input
              className="graph-color-input"
              type="color"
              value={styleConfig.relationLabelColor}
              onChange={(event) => updateStyle({ relationLabelColor: event.target.value })}
            />
          </label>
          <label className="graph-style-label" htmlFor="graph-relation-visibility">
            显示策略
          </label>
          <select
            id="graph-relation-visibility"
            className="graph-style-select"
            value={relationVisibility}
            onChange={(event) => {
              const value = event.target.value as 'highlight' | 'always';
              setRelationVisibility(value);
              updateStyle({ showRelationLabels: value === 'always' });
            }}
          >
            <option value="highlight">show on highlight only</option>
            <option value="always">always</option>
          </select>
        </section>

        <section className="graph-style-section">
          <h4 className="graph-style-section-title">画布</h4>
          <label className="graph-style-row">
            <span>背景颜色</span>
            <input
              className="graph-color-input"
              type="color"
              value={styleConfig.canvasBackground}
              onChange={(event) => updateStyle({ canvasBackground: event.target.value })}
            />
          </label>
          <label className="graph-style-checkbox">
            <input
              type="checkbox"
              checked={styleConfig.showGrid}
              onChange={(event) => updateStyle({ showGrid: event.target.checked })}
            />
            <span>显示网格</span>
          </label>
          <label className="graph-style-checkbox">
            <input
              type="checkbox"
              checked={highContrastEnabled}
              onChange={(event) =>
                updateStyle(
                  event.target.checked
                    ? {
                        canvasBackground: '#080B12',
                        nodeColor: '#F8D866',
                        edgeColor: '#F5F7FA',
                        labelColor: '#F5F7FA',
                        relationLabelColor: '#F8D866',
                      }
                    : {
                        canvasBackground: DEFAULT_STYLE_CONFIG.canvasBackground,
                        nodeColor: DEFAULT_STYLE_CONFIG.nodeColor,
                        edgeColor: DEFAULT_STYLE_CONFIG.edgeColor,
                        labelColor: DEFAULT_STYLE_CONFIG.labelColor,
                        relationLabelColor: DEFAULT_STYLE_CONFIG.relationLabelColor,
                      },
                )
              }
            />
            <span>高对比度</span>
          </label>
        </section>
      </div>
    </aside>
  );
}
