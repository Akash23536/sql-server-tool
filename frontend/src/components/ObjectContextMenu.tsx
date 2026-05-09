import { useState, useEffect, useRef } from 'react';
import type { DbObject } from '../api';

interface ObjectContextMenuProps {
  x: number;
  y: number;
  obj: DbObject;
  onAction: (obj: DbObject, action: string) => void;
  onClose: () => void;
}

export function ObjectContextMenu({ x, y, obj, onAction, onClose }: ObjectContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const submenuTimer = useRef<number | null>(null);
  const [position, setPosition] = useState({ top: y, left: x });
  const [flipSubmenu, setFlipSubmenu] = useState(false);
  const [flipSubmenuVertical, setFlipSubmenuVertical] = useState(false);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let nextLeft = x;
      let nextTop = y;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth) {
        nextLeft = viewportWidth - rect.width - 5;
      }
      
      // Check if submenus will overflow horizontally
      if (nextLeft + rect.width + 240 > viewportWidth) {
        setFlipSubmenu(true);
      } else {
        setFlipSubmenu(false);
      }

      // Adjust vertical position for main menu
      if (y + rect.height > viewportHeight) {
        nextTop = Math.max(5, viewportHeight - rect.height - 5);
      }
      
      // Check if submenus will overflow vertically (approx 350px height)
      if (nextTop + 350 > viewportHeight) {
        setFlipSubmenuVertical(true);
      } else {
        setFlipSubmenuVertical(false);
      }

      setPosition({ top: nextTop, left: nextLeft });
    }
  }, [x, y, activeSubmenu]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Tiny delay ensures the opening click doesn't immediately trigger the close logic
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleAction = (action: string) => {
    onAction(obj, action);
    onClose();
  };

  const handleMouseEnter = (menuName: string) => {
    if (submenuTimer.current) window.clearTimeout(submenuTimer.current);
    setActiveSubmenu(menuName);
  };

  const handleMouseLeave = () => {
    submenuTimer.current = window.setTimeout(() => {
      setActiveSubmenu(null);
    }, 300);
  };

  const type = obj.objectType?.toUpperCase() || '';
  const isTable = type === 'TABLE' || type === 'U';
  const isView = type === 'VIEW' || type === 'V';
  const isProc = type === 'PROCEDURE' || type === 'P';
  const isFunc = type.includes('FUNCTION') || type === 'FN' || type === 'TF' || type === 'IF';
  const isTableLike = isTable || isView;

  const SubmenuItem = ({ label, action, disabled = false }: { label: string; action: string; disabled?: boolean }) => (
    <div 
      className={`px-3 py-1.5 flex justify-between items-center group/item ${disabled ? 'opacity-30 cursor-default' : 'hover:bg-[#0078d4] hover:text-white cursor-pointer'}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) handleAction(action);
      }}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-40 group-hover/item:opacity-100">▶ Editor</span>
    </div>
  );

  return (
    <div
      ref={menuRef}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[1200] bg-[#fdfdfd] dark:bg-[#252526] border border-[#ccc] dark:border-[#454545] shadow-2xl py-1 min-w-[220px] text-[11px] md:text-xs rounded-sm select-none font-sans text-gray-800 dark:text-gray-200 overflow-y-auto md:overflow-visible max-h-[calc(100vh-10px)]"
      style={{ 
        top: position.top, 
        left: position.left,
        opacity: menuRef.current ? 1 : 0,
        transition: 'opacity 0.05s ease-in'
      }}
    >
      {/* Script As Submenu (SSMS Style) */}
      <div 
        className={`px-3 py-1.5 flex flex-col md:flex-row md:items-center justify-between cursor-pointer relative group ${activeSubmenu === 'script' ? 'bg-[#0078d4] text-white' : 'hover:bg-[#0078d4] hover:text-white'}`}
        onMouseEnter={() => handleMouseEnter('script')}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          if (window.innerWidth <= 768) {
            e.stopPropagation();
            setActiveSubmenu(activeSubmenu === 'script' ? null : 'script');
          }
        }}
      >
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span>📜</span> Script {isTable ? 'Table' : (isProc ? 'Stored Procedure' : (isView ? 'View' : 'Object'))} as
          </div>
          <span className={`text-[10px] transition-transform ${activeSubmenu === 'script' ? 'rotate-90 md:rotate-0' : ''}`}>▶</span>
        </div>
        
        {activeSubmenu === 'script' && (
          <div className={`md:absolute ${flipSubmenuVertical ? 'md:bottom-0 md:-mb-1' : 'md:top-0 md:-mt-1'} ${flipSubmenu ? 'md:right-full md:mr-px' : 'md:left-full md:ml-px'} mt-2 md:mt-0 w-full md:w-auto bg-[#fdfdfd] dark:bg-[#252526] md:border border-[#ccc] dark:border-[#454545] shadow-inner md:shadow-2xl py-1 md:min-w-[240px] rounded-sm z-[1300] text-gray-800 dark:text-gray-200`}>
            <SubmenuItem label="CREATE To" action="create" />
            {!isTable && <SubmenuItem label="ALTER To" action="alter" />}
            {!isTable && <SubmenuItem label="CREATE OR ALTER To" action="create_or_alter" />}
            <SubmenuItem label="DROP To" action="drop" />
            <SubmenuItem label="DROP And CREATE To" action="drop_and_create" />
            
            {(isTableLike || isTable || isProc || isFunc) && (
              <div className="h-px bg-gray-100 dark:bg-[#454545] my-1 mx-1"></div>
            )}
            
            {isTableLike && <SubmenuItem label="SELECT To" action="select_top_50" />}
            {isTable && <SubmenuItem label="INSERT To" action="insert" />}
            {isTableLike && <SubmenuItem label="INSERT Data To" action="insert_data" />}
            {isTable && <SubmenuItem label="UPDATE To" action="update" />}
            {isTable && <SubmenuItem label="DELETE To" action="delete" />}
            
            {(isProc || isFunc) && <SubmenuItem label="EXECUTE To" action="execute" />}
            
            <div className="h-px bg-gray-100 dark:bg-[#454545] my-1 mx-1"></div>
            
            <SubmenuItem label="RENAME To" action="rename" />
          </div>
        )}
      </div>

      <div className="h-px bg-gray-200 dark:bg-[#454545] my-1"></div>

      {/* Bottom Actions */}
      <div className="px-3 py-1.5 hover:bg-[#0078d4] hover:text-white cursor-pointer flex items-center gap-2" onClick={() => handleAction('compare')}>
        <span>↔️</span> Compare Object
      </div>
    </div>
  );
}
