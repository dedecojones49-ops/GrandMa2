'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Plus, 
  Layers, 
  Hash, 
  Globe, 
  Zap, 
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FixtureType {
  name: string;
  channels: number;
  type: string;
}

interface PatchWindowProps {
  onClose: () => void;
  fixtureLibrary: FixtureType[];
  onPatch: (params: {
    fixture: FixtureType;
    startId: number;
    quantity: number;
    universe: number;
    address: number;
  }) => void;
  initialParams?: {
    startId: number;
    quantity: number;
    universe: number;
    address: number;
  };
}

export default function PatchWindow({ 
  onClose, 
  fixtureLibrary, 
  onPatch,
  initialParams = { startId: 1, quantity: 1, universe: 1, address: 1 }
}: PatchWindowProps) {
  const [selectedFixture, setSelectedFixture] = useState<FixtureType | null>(null);
  const [startId, setStartId] = useState(initialParams.startId);
  const [quantity, setQuantity] = useState(initialParams.quantity);
  const [universe, setUniverse] = useState(initialParams.universe);
  const [address, setAddress] = useState(initialParams.address);
  const [filter, setFilter] = useState('');

  const filteredLibrary = fixtureLibrary.filter(f => 
    f.name.toLowerCase().includes(filter.toLowerCase()) || 
    f.type.toLowerCase().includes(filter.toLowerCase())
  );

  const handlePatch = () => {
    if (!selectedFixture) return;
    onPatch({
      fixture: selectedFixture,
      startId,
      quantity,
      universe,
      address
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Plus className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">Console Patch Manager</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">GrandMA2 Telnet Infrastructure</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Side: Library */}
          <div className="w-full md:w-2/3 border-r border-zinc-800 flex flex-col bg-zinc-900/50">
            <div className="p-4 border-b border-zinc-800">
              <input 
                type="text"
                placeholder="Search Fixture Types..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
              {filteredLibrary.map((fix, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFixture(fix)}
                  className={cn(
                    "flex flex-col p-4 rounded-lg border transition-all text-left group",
                    selectedFixture?.name === fix.name
                      ? "bg-emerald-500/10 border-emerald-500/50"
                      : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-xs font-black uppercase tracking-widest",
                      selectedFixture?.name === fix.name ? "text-emerald-400" : "text-zinc-500"
                    )}>
                      {fix.type}
                    </span>
                    <Package className={cn(
                      "w-3 h-3 group-hover:scale-110 transition-transform",
                      selectedFixture?.name === fix.name ? "text-emerald-500" : "text-zinc-700"
                    )} />
                  </div>
                  <div className="text-sm font-bold text-zinc-200 mb-1">{fix.name}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">FOOTPRINT: {fix.channels} CHANNELS</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Configuration */}
          <div className="w-full md:w-1/3 p-6 space-y-6 bg-zinc-950/30 overflow-y-auto">
            <div className="space-y-4">
              <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-2">
                <Layers className="w-3 h-3" /> Patch Parameters
              </div>

              {/* Start ID */}
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5">
                  <Hash className="w-3 h-3" /> Starting Fixture ID
                </label>
                <input 
                  type="number"
                  value={startId}
                  onChange={(e) => setStartId(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5">
                  <Package className="w-3 h-3" /> Quantity to Patch
                </label>
                <input 
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Universe */}
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Universe
                </label>
                <input 
                  type="number"
                  value={universe}
                  onChange={(e) => setUniverse(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-lcd-text focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Start Address
                </label>
                <input 
                  type="number"
                  value={address}
                  onChange={(e) => setAddress(Math.max(1, Math.min(512, parseInt(e.target.value) || 1)))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono text-lcd-text focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Summary */}
            {selectedFixture && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="text-[10px] text-zinc-500 font-bold uppercase border-b border-zinc-800 pb-2">Command Preview</div>
                <div className="font-mono text-[10px] text-zinc-400 break-all bg-black/40 p-2 rounded border border-white/5 italic">
                  Fixture {startId} THRU {startId + quantity - 1} AT {universe}.{address}
                </div>
                <div className="text-[9px] text-zinc-600 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Total Footprint: {quantity * selectedFixture.channels} Channels
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> End Address: {address + (quantity * selectedFixture.channels) - 1}
                  </div>
                  {address + (quantity * selectedFixture.channels) - 1 > 512 && (
                    <div className="flex items-center gap-1.5 text-amber-500">
                      <AlertCircle className="w-3 h-3" /> WARNING: UNIVERSE OVERFLOW
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              disabled={!selectedFixture}
              onClick={handlePatch}
              className={cn(
                "w-full h-12 flex items-center justify-center gap-2 rounded-xl border transition-all font-bold uppercase tracking-widest text-[11px]",
                selectedFixture 
                  ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-black shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98]" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 opacity-50"
              )}
            >
              <Plus className="w-4 h-4" /> Execute Patch Request
            </button>
            <p className="text-[8px] text-zinc-600 text-center uppercase font-black">Requires MA2 Telnet (Port 30000) Reachability</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
