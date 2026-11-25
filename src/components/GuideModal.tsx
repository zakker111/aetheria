import React from 'react';
import gameBanner from '../assets/images/aetheria_game_banner_1790511715234.jpg';

export interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900/95 border border-white/15 px-5 py-4 rounded-2xl text-xs max-w-[390px] w-full text-slate-300 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={gameBanner}
          alt="Aetheria 2.5D Realm"
          referrerPolicy="no-referrer"
          className="w-full rounded-lg mb-2.5 border border-white/15 block aspect-[16/9] object-cover"
        />
        <h3 className="mb-1.5 text-rose-500 text-xs font-bold flex justify-between items-center">
          <span>Divine Instructions</span>
          <button
            onClick={onClose}
            aria-label="Close guide"
            className="bg-transparent border-0 text-slate-400 hover:text-slate-200 cursor-pointer text-sm leading-none"
          >
            ✕
          </button>
        </h3>
        <div className="my-1">
          • <b>2.5D Isometric World &amp; Ecology:</b> Elevated terrain with growing forests (Sapling
          → Ancient), finite depleting ore mines, and wild herds stalked by settlement Hunters.
        </div>
        <div className="my-1">
          • <b>Era Buildings &amp; Upgrades (Lv 1–3):</b> Unlock Windmills, Inns, Libraries,
          Apothecaries, Citadels, Banks, Factories, Research Labs, Air Defense Radars, Nuclear
          Plants &amp; Silos—each boosting farms, XP, healing, trade, stability, or defense!
        </div>
        <div className="my-1">
          • <b>Atomic Deterrence &amp; Infrastructure:</b> Warhead enrichment requires a{' '}
          <b>Factory + Nuclear Plant + Ore</b> (boosted by Labs &amp; Silos); autonomous nukes
          fire only as a last resort.
        </div>
        <div className="my-1">
          • <b>Deep Diplomacy (W):</b> Scarcity Trade &amp; Non-Aggression Pacts, nuclear
          proliferation sanctions, ultimatums, Tributary Vassalage, and third-party Peace
          Mediation.
        </div>
        <div className="my-1">
          • <b>Spectator Controls:</b> Use <b>⚔️ Next Battle</b> to jump to active fronts, or
          inspect citizens, buildings, and mines for live stats &amp; Follow camera.
        </div>
        <div className="my-1">
          • <b>Drag</b> map to pan · <b>Scroll wheel</b> to zoom · <b>Keys 1-0</b> for tools ·{' '}
          <b>Spacebar</b> pause/resume
        </div>
      </div>
    </div>
  );
};

export default GuideModal;
