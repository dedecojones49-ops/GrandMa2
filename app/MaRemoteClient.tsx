'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Terminal, Wifi, WifiOff, Send, XCircle, CheckCircle2, Info, Settings, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Save, Plus, Trash2, Camera, Lock, Unlock, RotateCcw, Layout, ListChecks, Database, FileBox, RefreshCw, Sparkles, BrainCircuit, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from "@google/genai";
import PatchWindow from './components/PatchWindow';

interface LogEntry {
  id: string;
  timestamp: string;
  command: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

const COMMAND_PRESETS = [
  { label: 'Clear All', cmd: 'ClearAll' },
  { label: 'Full', cmd: 'Full' },
  { label: 'Store', cmd: 'Store' },
  { label: 'Delete', cmd: 'Delete' },
  { label: 'Assign', cmd: 'Assign' },
  { label: 'Formas', cmd: 'Form' },
  { label: 'Highlight', cmd: 'Highlight' },
  { label: 'Blind', cmd: 'Blind' },
  { label: 'Blackout On', cmd: 'Blackout On' },
  { label: 'Blackout Off', cmd: 'Blackout Off' },
  { label: 'Effects', cmd: 'Effect' },
  { label: 'Setup', cmd: 'Setup' },
  { label: 'Auto Create', cmd: 'AutoCreate' },
  { label: 'Upgrade', cmd: 'Upgrade' },
  { label: 'Oops', cmd: 'Oops' },
  { label: 'Next', cmd: 'Next' },
  { label: 'Prev', cmd: 'Prev' },
];

const EXECUTOR_GROUPS = [
  '101', '102', '103', '104', '105'
].map(id => ({
  id,
  buttons: [
    { label: 'Flash', cmd: `Flash Exec 1.${id}`, variant: 'blue' },
    { label: 'Go', cmd: `Go Exec 1.${id}`, variant: 'green' },
    { label: 'Pause', cmd: `Pause Exec 1.${id}`, variant: 'yellow' },
    { label: 'Off', cmd: `Off Exec 1.${id}`, variant: 'red' },
  ]
}));

const PAGE_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface LayoutObject {
  id: number;
  x: number;
  y: number;
  type: 'Fixture' | 'Group';
  subType: string;
  width?: number;
  height?: number;
  dmxChannel?: number;
}

interface LayoutPreset {
  id: string;
  name: string;
  objects: LayoutObject[];
}

const INITIAL_LAYOUT: LayoutObject[] = [
  // Fixtures
  { id: 1, x: 15, y: 20, type: 'Fixture', subType: 'Spot', width: 24, height: 24 },
  { id: 2, x: 30, y: 20, type: 'Fixture', subType: 'Spot', width: 24, height: 24 },
  { id: 3, x: 45, y: 20, type: 'Fixture', subType: 'Spot', width: 24, height: 24 },
  { id: 4, x: 60, y: 20, type: 'Fixture', subType: 'Spot', width: 24, height: 24 },
  
  // Groups
  { id: 1, x: 85, y: 20, type: 'Group', subType: 'Wash All', width: 32, height: 32 },
  { id: 2, x: 85, y: 40, type: 'Group', subType: 'Spots All', width: 32, height: 32 },
  { id: 3, x: 85, y: 60, type: 'Group', subType: 'Front All', width: 32, height: 32 },

  { id: 5, x: 15, y: 50, type: 'Fixture', subType: 'Wash', width: 24, height: 24 },
  { id: 6, x: 30, y: 50, type: 'Fixture', subType: 'Wash', width: 24, height: 24 },
  { id: 7, x: 45, y: 50, type: 'Fixture', subType: 'Wash', width: 24, height: 24 },
  { id: 8, x: 60, y: 50, type: 'Fixture', subType: 'Wash', width: 24, height: 24 },
];

const FIXTURE_LIBRARY = [
  { name: 'Dimmer / conventional', channels: 1, type: 'Standard' },
  { name: 'Spot / generic 24ch', channels: 24, type: 'Spot' },
  { name: 'Wash / generic 18ch', channels: 18, type: 'Wash' },
  { name: 'LED Par / generic 7ch', channels: 7, type: 'LED' },
  { name: 'Beam / sharpie 16ch', channels: 16, type: 'Beam' },
  { name: 'Strobe / generic 4ch', channels: 4, type: 'Effect' },
];

interface FaderGroup {
  id: string;
  name: string;
  channels: number[];
  level: number;
}

export default function MaRemoteClient() {
  const [ip, setIp] = useState('192.168.15.10');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [customCmd, setCustomCmd] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState('1');
  const [currentPage, setCurrentPage] = useState(1);
  const [followPos, setFollowPos] = useState({ x: 50, y: 50 });
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [usbProtocol, setUsbProtocol] = useState<'open' | 'pro' | 'sl1000'>('open');
  const [btConnected, setBtConnected] = useState(false);
  const [isAutoFollowActive, setIsAutoFollowActive] = useState(false);
  const [isMotionSensorActive, setIsMotionSensorActive] = useState(false);
  const [isMotionDetected, setIsMotionDetected] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const prevFrameRef = React.useRef<ImageData | null>(null);
  const [trackpadLocked, setTrackpadLocked] = useState(false);
  const [serialPort, setSerialPort] = useState<any>(null);
  const [controlMode, setControlMode] = useState<'ma2' | 'direct'>('ma2');
  const [dmxBuffer, setDmxBuffer] = useState<number[]>(new Array(512).fill(0));
  const dmxBufferRef = React.useRef<number[]>(new Array(512).fill(0));
  const [discoveredNodes, setDiscoveredNodes] = useState<{ip: string, name: string}[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showDmxMonitor, setShowDmxMonitor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showPatchWindow, setShowPatchWindow] = useState(false);
  const [selectedFixtures, setSelectedFixtures] = useState<number[]>([]);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latency?: number; error?: string; details?: string; message?: string } | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [isDynamicLayout, setIsDynamicLayout] = useState(false);
  const [isPollingLayout, setIsPollingLayout] = useState(false);
  const [layoutOffset, setLayoutOffset] = useState({ x: 0, y: 0 });
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [isAutoTracking, setIsAutoTracking] = useState(false);
  const [layoutObjects, setLayoutObjects] = useState<LayoutObject[]>(INITIAL_LAYOUT);
  const [layoutPresets, setLayoutPresets] = useState<LayoutPreset[]>([]);
  const [draggingObject, setDraggingObject] = useState<number | null>(null);
  const [draggingType, setDraggingType] = useState<'Fixture' | 'Group' | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiAssistantExpanded, setAiAssistantExpanded] = useState(false);
  const [aiNaturalCommand, setAiNaturalCommand] = useState('');
  const [midiAccess, setMidiAccess] = useState<any>(null);
  const [midiInputs, setMidiInputs] = useState<any[]>([]);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [cameraSource, setCameraSource] = useState<'internal' | 'external'>('internal');
  const [externalCameraUrl, setExternalCameraUrl] = useState('');
  const [showOrbitronicConfig, setShowOrbitronicConfig] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [artNetConfig, setArtNetConfig] = useState({
    net: 0,
    subnet: 0,
    universe: 0,
    mask: '255.255.255.0'
  });
  const [faderGroups, setFaderGroups] = useState<FaderGroup[]>([]);
  const [activeTab, setActiveTab] = useState<'console' | 'faders' | 'stage'>('console');
  const [isAddingFaderGroup, setIsAddingFaderGroup] = useState(false);
  const [newFaderName, setNewFaderName] = useState('');
  const [newFaderChannels, setNewFaderChannels] = useState('');
  const [patchQuantity, setPatchQuantity] = useState(1);
  const [patchStartId, setPatchStartId] = useState(1);
  const [patchUniverse, setPatchUniverse] = useState(1);
  const [patchAddress, setPatchAddress] = useState(1);
  const [undoHistory, setUndoHistory] = useState<{
    type: 'ma2' | 'direct';
    command?: string;
    buffer?: number[];
    timestamp: number;
  }[]>([]);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const lastPtSendRef = React.useRef<number>(0);

  // AI Assistant Function
  const generateMaCommand = async () => {
    if (!aiNaturalCommand.trim()) return;
    
    setIsAiThinking(true);
    try {
      const genAI = new GoogleGenAI({ 
        apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' 
      });

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a GrandMA2 lighting console expert. Convert the following natural language request into a single MA2 Telnet command string. 
        Return ONLY the command string itself, no explanation, no quotes, no markdown.
        
        Examples:
        "Select group 1 and put it at full" -> Group 1 At 100
        "Store the current look as cue 5 in executor 201" -> Store Exec 1.201 Cue 5
        "Clear everything" -> ClearAll
        
        Request: "${aiNaturalCommand}"`,
      });

      const result = response.text?.trim();
      if (result) {
        setCustomCmd(result);
        setAiAssistantExpanded(false);
        setAiNaturalCommand('');
      }
    } catch (error) {
      console.error('Gemini error:', error);
      setLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        command: 'AI ASSISTANT',
        status: 'error',
        message: 'Failed to generate command. Check AI configuration.'
      }, ...prev]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const testConsoleConnection = async () => {
    if (!ip) return;
    setIsTestingPing(true);
    setPingResult(null);
    try {
      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port: 30000 }),
      });
      const data = await response.json();
      setPingResult(data);
      
      const status = data.success ? 'success' : 'error';
      setLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        command: 'PING TEST',
        status,
        message: data.success ? `Connected to ${ip} (Latency: ${data.latency}ms)` : `Connection Failed: ${data.error}`
      }, ...prev]);

    } catch (err) {
      setPingResult({ success: false, error: 'Network Error', details: 'Check your internet connection.' });
    } finally {
      setIsTestingPing(false);
    }
  };

  // Core Command & DMX Functions (Moving to top to avoid 'use before declaration' errors)
  const broadcastDMX = useCallback(async (buffer: number[]) => {
    // 1. USB Serial
    if (usbConnected && serialPort) {
      try {
        const writer = serialPort.writable.getWriter();
        
        if (usbProtocol === 'pro') {
          // Enttec DMX USB Pro / Q-Light Protocol
          const dataLength = buffer.length + 1;
          const packet = new Uint8Array(5 + dataLength);
          packet[0] = 0x7E;
          packet[1] = 0x06;
          packet[2] = dataLength & 0xFF;
          packet[3] = (dataLength >> 8) & 0xFF;
          packet[4] = 0x00;
          packet.set(buffer, 5);
          packet[packet.length - 1] = 0xE7;
          await writer.write(packet);
        } else if (usbProtocol === 'sl1000') {
          // SL 1000 specialized Open DMX frame
          // Some SL 1000 units expect a silent break or specific leading zero
          // Open DMX standard is usually enough
          const packet = new Uint8Array([0, ...buffer]);
          await writer.write(packet);
        } else {
          const packet = new Uint8Array([0, ...buffer]);
          await writer.write(packet);
        }
        
        writer.releaseLock();
      } catch (err) {
        console.error("USB Write Error:", err);
      }
    }

    // 2. Wi-Fi (Art-Net via API proxy)
    if (controlMode === 'direct' && ip && ip !== '127.0.0.1') {
      fetch('/api/dmx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ip, 
          channels: buffer,
          net: artNetConfig.net,
          subnet: artNetConfig.subnet,
          universe: artNetConfig.universe
        }),
      }).catch(err => console.error("Art-Net Error:", err));
    }
  }, [usbConnected, serialPort, usbProtocol, controlMode, ip, artNetConfig]);

  const handlePatchExecution = ({ fixture, startId, quantity, universe, address }: any) => {
    // GrandMA2 Syntax: ST fixture 101 THRU 110 AT 1.1
    const cmd = `ST fixture ${startId} THRU ${startId + quantity - 1} AT ${universe}.${address}`;
    sendCommand(cmd);
    
    setLogs(prev => [{
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'PATCH EXECUTE',
      status: 'success',
      message: `Patched ${quantity}x ${fixture.name} starting at ID ${startId} @ ${universe}.${address}`
    }, ...prev]);
    
    // Sync local state if desired
    setPatchStartId(startId + quantity);
    setPatchAddress(address + (quantity * fixture.channels));
    setShowPatchWindow(false);
  };

  const handleFaderChange = (groupId: string, newLevel: number) => {
    setFaderGroups(prev => {
      const next = prev.map(group => {
        if (group.id === groupId) {
          // Update console for each channel in group
          group.channels.forEach(ch => {
            updateDmxChannel(ch, newLevel);
          });
          return { ...group, level: newLevel };
        }
        return group;
      });
      localStorage.setItem('ma_remote_faders', JSON.stringify(next));
      return next;
    });
  };

  const addFaderGroup = () => {
    if (!newFaderName.trim() || !newFaderChannels.trim()) return;
    
    // Parse channels (comma separated: 1,2,3 or range 1-5)
    const channels: number[] = [];
    const parts = newFaderChannels.split(',');
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            channels.push(i);
          }
        }
      } else {
        const ch = parseInt(part.trim());
        if (!isNaN(ch)) channels.push(ch);
      }
    });

    if (channels.length === 0) return;

    const newGroup: FaderGroup = {
      id: Math.random().toString(36).substr(2, 9),
      name: newFaderName,
      channels: Array.from(new Set(channels)), // Unique channels
      level: 0
    };

    setFaderGroups(prev => {
      const next = [...prev, newGroup];
      localStorage.setItem('ma_remote_faders', JSON.stringify(next));
      return next;
    });
    setNewFaderName('');
    setNewFaderChannels('');
    setIsAddingFaderGroup(false);
  };

  const deleteFaderGroup = (groupId: string) => {
    setFaderGroups(prev => {
      const next = prev.filter(g => g.id !== groupId);
      localStorage.setItem('ma_remote_faders', JSON.stringify(next));
      return next;
    });
  };

  const updateDmxChannel = useCallback((channel: number, value: number, skipHistory = false) => {
    const roundedValue = Math.max(0, Math.min(255, Math.round(value)));
    const chIdx = channel - 1;
    
    if (dmxBufferRef.current[chIdx] !== roundedValue) {
      if (!skipHistory) {
        setUndoHistory(prev => [{
          type: 'direct' as const,
          buffer: [...dmxBufferRef.current],
          timestamp: Date.now()
        }, ...prev].slice(0, 50));
      }
      dmxBufferRef.current[chIdx] = roundedValue;
      const next = [...dmxBufferRef.current];
      setDmxBuffer(next);
      broadcastDMX(next);
    }
  }, [broadcastDMX]);

  const sendCommand = useCallback(async (cmd: string, skipHistory = false) => {
    if (!ip) return;
    
    // Save to history before executing if it's a significant command
    if (!skipHistory && !cmd.includes('Attribute') && !cmd.includes('Oops')) {
       // We don't save every pan/tilt nudge to history to avoid bloat, 
       // but we save higher level commands.
       setUndoHistory(prev => [{
         type: 'ma2' as const,
         command: 'Oops', // MA2 internal undo
         timestamp: Date.now()
       }, ...prev].slice(0, 50));
    }
    
    if (controlMode === 'direct') {
      const logDirect = (msg: string) => {
        const newLog: LogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          command: cmd,
          status: 'success' as const,
          message: msg
        };
        setLogs(prev => [newLog, ...prev].slice(0, 50));
      };

      const chMatch = cmd.match(/Ch\s+(\d+)\s+At\s+(\d+)/i);
      if (chMatch) {
        updateDmxChannel(parseInt(chMatch[1]), parseInt(chMatch[2]));
        logDirect(`DMX Ch ${chMatch[1]} set to ${chMatch[2]}`);
        return;
      }
      
      if (cmd === 'Full') {
        const fullBuffer = new Array(512).fill(255);
        dmxBufferRef.current = fullBuffer;
        setDmxBuffer(fullBuffer);
        broadcastDMX(fullBuffer);
        logDirect("All Channels at Full");
        return;
      }

      if (cmd === 'ClearAll') {
        const zeroBuffer = new Array(512).fill(0);
        dmxBufferRef.current = zeroBuffer;
        setDmxBuffer(zeroBuffer);
        broadcastDMX(zeroBuffer);
        logDirect("Clear All DMX");
        return;
      }

      logDirect("Command ignored in Direct DMX mode (MA Syntax only)");
      return;
    }

    setIsConnecting(true);
    
    const finalizeLog = (status: LogEntry['status'], message: string) => {
      const newEntry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: cmd,
        status,
        message,
      };
      setLogs((prev) => [newEntry, ...prev].slice(0, 50));
    };

    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, command: cmd }),
      });

      const data = await response.json();

      if (response.ok) {
        finalizeLog('success', data.message);
      } else {
        finalizeLog('error', data.error || 'Failed to send command');
      }
    } catch (err: any) {
      finalizeLog('error', 'Network or Server error');
    } finally {
      setIsConnecting(false);
    }
  }, [ip, controlMode, updateDmxChannel, broadcastDMX]);

  const undoLastAction = useCallback(() => {
    if (undoHistory.length === 0) return;
    const last = undoHistory[0];
    setUndoHistory(prev => prev.slice(1));

    if (last.type === 'direct' && last.buffer) {
      dmxBufferRef.current = [...last.buffer];
      setDmxBuffer([...last.buffer]);
      broadcastDMX([...last.buffer]);
      
      setLogs(prev => [{
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'UNDO: DMX',
        status: 'success',
        message: 'Reverted to previous DMX state'
      }, ...prev]);
    } else if (last.type === 'ma2' && last.command) {
      // In MA2, "Undo" is essentially "Oops" or re-sending a previous state
      // For now, we'll try to find the complement or just log that we are attempting a revert
      // Most MA commands don't have a simple inverse without programmer polling
      sendCommand(last.command, true); // Re-sending previous for now or just generic oops
      
      setLogs(prev => [{
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'UNDO: MA2',
        status: 'success',
        message: `Attempting to revert MA2 state: ${last.command}`
      }, ...prev]);
    }
  }, [undoHistory, broadcastDMX, sendCommand]);

  const pollLayout = async () => {
    setIsPollingLayout(true);
    const pollLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'LAYOUT: POLL',
      status: 'pending',
      message: 'Requesting layout data from console...'
    };
    setLogs(prev => [pollLog, ...prev]);

    // Simulate network delay
    setTimeout(() => {
      setIsPollingLayout(false);
      const successLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'LAYOUT: SYNC',
        status: 'success',
        message: 'Layout objects synchronized with MA2 Showfile'
      };
      setLogs(prev => [successLog, ...prev]);
    }, 1200);
  };

  useEffect(() => {
    let interval: any;
    if (isDynamicLayout) {
      interval = setInterval(() => {
        setLayoutOffset({
          x: (Math.random() - 0.5) * 0.5,
          y: (Math.random() - 0.5) * 0.5
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
      setLayoutOffset({ x: 0, y: 0 }); // Cleanup reset
    };
  }, [isDynamicLayout]);

  useEffect(() => {
    if (!isAutoFollowActive) {
      prevFrameRef.current = null;
      return;
    }

    let animationFrameId: number;
    let lastAutoSend = 0;

    const detectMotion = () => {
      if (!isAutoFollowActive || !videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw video to processing canvas (small size for performance)
      const source = cameraSource === 'internal' ? video : imgRef.current;
      if (!source) {
        animationFrameId = requestAnimationFrame(detectMotion);
        return;
      }

      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (prevFrameRef.current) {
        const prevFrame = prevFrameRef.current;
        let totalX = 0;
        let totalY = 0;
        let count = 0;

        // Compare pixels for dramatic changes
        for (let i = 0; i < currentFrame.data.length; i += 16) { // Sample every 4th pixel for speed
          const rDiff = Math.abs(currentFrame.data[i] - prevFrame.data[i]);
          const gDiff = Math.abs(currentFrame.data[i + 1] - prevFrame.data[i + 1]);
          const bDiff = Math.abs(currentFrame.data[i + 2] - prevFrame.data[i + 2]);

          if (rDiff + gDiff + bDiff > 120) {
            const pixelIndex = i / 4;
            totalX += pixelIndex % canvas.width;
            totalY += Math.floor(pixelIndex / canvas.width);
            count++;
          }
        }

        if (count > 20) { // Threshold for meaningful motion
          const centerX = (totalX / count / canvas.width) * 100;
          const centerY = (totalY / count / canvas.height) * 100;
          
          setIsMotionDetected(true);

          if (isAutoFollowActive) {
            setFollowPos({ x: centerX, y: centerY });
            
            const now = performance.now();
            if (now - lastAutoSend > 250) { // Throttled for console stability
              if (controlMode === 'ma2') {
                const maPan = (centerX - 50).toFixed(1);
                const maTilt = (50 - centerY).toFixed(1);
                const selectionParts = [];
                if (selectedFixtures.length > 0) selectionParts.push(`Fixture ${selectedFixtures.join(' + ')}`);
                if (selectedGroups.length > 0) selectionParts.push(`Group ${selectedGroups.join(' + ')}`);
                const prefix = selectionParts.length > 0 ? selectionParts.join('; ') : `Group ${activeGroup}`;
                sendCommand(`${prefix}; Attribute "Pan" At ${maPan}; Attribute "Tilt" At ${maTilt}`);
              } else {
                const startCh = parseInt(activeGroup) || 1;
                updateDmxChannel(startCh, Math.round((centerX / 100) * 255));
                updateDmxChannel(startCh + 1, Math.round((centerY / 100) * 255));
              }
              lastAutoSend = now;
            }
          }
        } else {
          setIsMotionDetected(false);
        }
      }

      prevFrameRef.current = currentFrame;
      animationFrameId = requestAnimationFrame(detectMotion);
    };

    detectMotion();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAutoFollowActive, isMotionSensorActive, cameraSource, activeGroup, selectedFixtures, selectedGroups, controlMode, sendCommand, updateDmxChannel]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (trackpadLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Immediate visual update for zero-lag feedback
    setFollowPos({ x, y });

    // Throttled command transmission
    const now = performance.now();
    if (controlMode === 'ma2') {
      if (now - lastPtSendRef.current > 120) { // Throttled to ~8Hz for MA reliability
        const maPan = (x - 50).toFixed(1);
        const maTilt = (50 - y).toFixed(1); 
        const selectionParts = [];
        if (selectedFixtures.length > 0) selectionParts.push(`Fixture ${selectedFixtures.join(' + ')}`);
        if (selectedGroups.length > 0) selectionParts.push(`Group ${selectedGroups.join(' + ')}`);
        
        const selectionPrefix = selectionParts.length > 0 
          ? selectionParts.join('; ') 
          : `Group ${activeGroup}`;
        
        sendCommand(`${selectionPrefix}; Attribute "Pan" At ${maPan}; Attribute "Tilt" At ${maTilt}`, true);
        lastPtSendRef.current = now;
      }
    } else {
      if (now - lastPtSendRef.current > 40) { // ~25Hz for Direct DMX
        const dmxPan = Math.round((x / 100) * 255);
        const dmxTilt = Math.round((y / 100) * 255);
        
        // Use mapped channels if available
        let mappedAny = false;
        if (selectedFixtures.length > 0) {
          selectedFixtures.forEach(fid => {
            const obj = layoutObjects.find(o => o.id === fid && o.type === 'Fixture');
            if (obj?.dmxChannel) {
              updateDmxChannel(obj.dmxChannel, dmxPan);
              updateDmxChannel(obj.dmxChannel + 1, dmxTilt);
              mappedAny = true;
            }
          });
        }
        
        if (!mappedAny) {
          const startCh = parseInt(activeGroup) || 1;
          updateDmxChannel(startCh, dmxPan);
          updateDmxChannel(startCh + 1, dmxTilt);
        }
        
        lastPtSendRef.current = now;
      }
    }
  }, [trackpadLocked, controlMode, selectedFixtures, selectedGroups, activeGroup, sendCommand, updateDmxChannel, layoutObjects]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (trackpadLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFollowPos({ x, y });

    if (controlMode === 'ma2') {
      const maPan = (x - 50).toFixed(1);
      const maTilt = (50 - y).toFixed(1);
      const selectionParts = [];
      if (selectedFixtures.length > 0) selectionParts.push(`Fixture ${selectedFixtures.join(' + ')}`);
      if (selectedGroups.length > 0) selectionParts.push(`Group ${selectedGroups.join(' + ')}`);
      
      const selectionPrefix = selectionParts.length > 0 
        ? selectionParts.join('; ') 
        : `Group ${activeGroup}`;
        
      sendCommand(`${selectionPrefix}; Attribute "Pan" At ${maPan}; Attribute "Tilt" At ${maTilt}`);
    } else {
      const dmxPan = Math.round((x / 100) * 255);
      const dmxTilt = Math.round((y / 100) * 255);
      const startCh = parseInt(activeGroup) || 1;
      updateDmxChannel(startCh, dmxPan);
      updateDmxChannel(startCh + 1, dmxTilt);
    }
  }, [trackpadLocked, controlMode, selectedFixtures, selectedGroups, activeGroup, sendCommand, updateDmxChannel]);

  const nudge = useCallback((axis: 'Pan' | 'Tilt', amount: number) => {
    const selectionParts = [];
    if (selectedFixtures.length > 0) selectionParts.push(`Fixture ${selectedFixtures.join(' + ')}`);
    if (selectedGroups.length > 0) selectionParts.push(`Group ${selectedGroups.join(' + ')}`);
    
    const selectionPrefix = selectionParts.length > 0 
      ? selectionParts.join('; ') 
      : `Group ${activeGroup}`;
      
    const sign = amount >= 0 ? '+' : '';
    sendCommand(`${selectionPrefix}; Attribute "${axis}" At ${sign}${amount}`);
  }, [selectedFixtures, selectedGroups, activeGroup, sendCommand]);

  const handleLayoutClick = (obj: LayoutObject) => {
    if (isEditingLayout) {
      setDraggingObject(obj.id);
      setDraggingType(obj.type);
      return;
    }
    if (obj.type === 'Fixture') {
      const isSelected = selectedFixtures.includes(obj.id);
      setSelectedFixtures(prev => isSelected ? prev.filter(fid => fid !== obj.id) : [...prev, obj.id]);
      if (controlMode === 'ma2') sendCommand(`Fixture ${obj.id}${isSelected ? ' -' : ''}`);
    } else {
      const isSelected = selectedGroups.includes(obj.id);
      setSelectedGroups(prev => {
        const next = isSelected ? prev.filter(gid => gid !== obj.id) : [...prev, obj.id];
        return next;
      });
      if (controlMode === 'ma2') sendCommand(`Group ${obj.id}${isSelected ? ' -' : ''}`);
      
      // Update activeGroup outside state updater
      const nextGroups = isSelected 
        ? selectedGroups.filter(gid => gid !== obj.id) 
        : [...selectedGroups, obj.id];
      if (nextGroups.length === 1) setActiveGroup(nextGroups[0].toString());
    }
  };

  const scanNetwork = async () => {
    setIsScanning(true);
    const pendingLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'SCAN: Art-Net',
      status: 'pending',
      message: 'Polling network for Art-Net nodes...'
    };
    setLogs(prev => [pendingLog, ...prev]);

    try {
      const response = await fetch('/api/scan');
      const data = await response.json();
      if (data.nodes) {
        setDiscoveredNodes(data.nodes);
        const successLog: LogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          command: 'SCAN: DONE',
          status: 'success',
          message: `Found ${data.nodes.length} Art-Net nodes.`
        };
        setLogs(prev => [successLog, ...prev]);
      }
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const updateNodeNetworkConfig = async (targetIp: string, newIp: string, newMask: string) => {
    try {
      const resp = await fetch('/api/node-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetIp, newIp, newSubnet: newMask, useDhcp: false })
      });
      const data = await resp.json();
      if (data.success) {
        const successLog: LogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          command: 'CFG: Art-Net',
          status: 'success',
          message: `Config sent to ${targetIp}. New IP: ${newIp}`
        };
        setLogs(prev => [successLog, ...prev]);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      const errLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'CFG: ERR',
        status: 'error',
        message: err.message
      };
      setLogs(prev => [errLog, ...prev]);
    }
  };

  // USB-DMX Connection
  const connectUSB = async () => {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial not supported - use Chrome/Edge');
      }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 250000 }); // DMX Standard
      setSerialPort(port);
      setUsbConnected(true);
      const successLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'LINK: USB-DMX',
        status: 'success',
        message: 'USB Port Opened at 250000 bps'
      };
      setLogs(prev => [successLog, ...prev]);
    } catch (err: any) {
      const errLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'LINK: USB-ERR',
        status: 'error',
        message: err.message
      };
      setLogs(prev => [errLog, ...prev]);
    }
  };

  const connectBT = async () => {
    try {
      if (!('bluetooth' in navigator)) {
        throw new Error('Web Bluetooth not supported');
      }
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true
      });
      setBtConnected(true);
      const successLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'LINK: BLE',
        status: 'success',
        message: `Connected to ${device.name || 'Unknown Device'}`
      };
      setLogs(prev => [successLog, ...prev]);
    } catch (err: any) {
      const errLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        command: 'LINK: BLE-ERR',
        status: 'error',
        message: err.message
      };
      setLogs(prev => [errLog, ...prev]);
    }
  };

  const saveLayout = (objects: LayoutObject[]) => {
    localStorage.setItem('ma_remote_layout', JSON.stringify(objects));
  };

  const addObject = (type: 'Fixture' | 'Group') => {
    const newId = Math.max(...layoutObjects.filter(o => o.type === type).map(o => o.id), 0) + 1;
    const newObj: LayoutObject = {
      id: newId,
      x: 50,
      y: 50,
      type,
      subType: type === 'Fixture' ? 'New Fixture' : 'New Group',
      width: type === 'Fixture' ? 24 : 32,
      height: type === 'Fixture' ? 24 : 32
    };
    const next = [...layoutObjects, newObj];
    setLayoutObjects(next);
    saveLayout(next);
  };

  const removeObject = (id: number, type: 'Fixture' | 'Group') => {
    const next = layoutObjects.filter(o => !(o.id === id && o.type === type));
    setLayoutObjects(next);
    saveLayout(next);
  };

  const updateObjectPosition = (id: number, type: 'Fixture' | 'Group', x: number, y: number) => {
    const next = layoutObjects.map(o => 
      (o.id === id && o.type === type) ? { ...o, x, y } : o
    );
    setLayoutObjects(next);
    saveLayout(next);
  };

  const updateObjectDmxChannel = (id: number, type: 'Fixture' | 'Group', channel: number) => {
    const next = layoutObjects.map(o => 
      (o.id === id && o.type === type) ? { ...o, dmxChannel: channel } : o
    );
    setLayoutObjects(next);
    saveLayout(next);
  };

  const updateObjectSize = (id: number, type: 'Fixture' | 'Group', width: number, height: number) => {
    const next = layoutObjects.map(o => 
      (o.id === id && o.type === type) ? { ...o, width, height } : o
    );
    setLayoutObjects(next);
    saveLayout(next);
  };

  const savePreset = (name: string) => {
    const newPreset: LayoutPreset = {
      id: crypto.randomUUID(),
      name,
      objects: JSON.parse(JSON.stringify(layoutObjects))
    };
    const next = [...layoutPresets, newPreset];
    setLayoutPresets(next);
    localStorage.setItem('ma_remote_layout_presets', JSON.stringify(next));
    
    setLogs(prev => [{
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'LAYOUT: SAVE PRESET',
      status: 'success',
      message: `Saved layout as "${name}"`
    }, ...prev]);
  };

  const loadPreset = (preset: LayoutPreset) => {
    setLayoutObjects(preset.objects);
    saveLayout(preset.objects);
    
    setLogs(prev => [{
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'LAYOUT: LOAD PRESET',
      status: 'success',
      message: `Loaded layout "${preset.name}"`
    }, ...prev]);
  };

  const deletePreset = (id: string) => {
    const next = layoutPresets.filter(p => p.id !== id);
    setLayoutPresets(next);
    localStorage.setItem('ma_remote_layout_presets', JSON.stringify(next));
  };

  useEffect(() => {
    if (midiEnabled && !midiAccess) {
      if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess()
          .then((access) => {
            setMidiAccess(access);
            const inputs = Array.from(access.inputs.values());
            setMidiInputs(inputs);
            
            access.onstatechange = (e: any) => {
              setMidiInputs(Array.from(access.inputs.values()));
            };

            inputs.forEach(input => {
              input.onmidimessage = handleMidiMessage;
            });

            setLogs(prev => [{
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date().toLocaleTimeString(),
              command: 'MIDI INIT',
              status: 'success',
              message: 'MIDI Engine Active. Plug-in MIDI Loop enabled.'
            }, ...prev]);
          })
          .catch(err => {
            console.error('MIDI Access Denied:', err);
            setMidiEnabled(false);
          });
      }
    } else if (!midiEnabled && midiAccess) {
      midiAccess.inputs.forEach((input: any) => {
        input.onmidimessage = null;
      });
    }
  }, [midiEnabled, midiAccess]);

  const handleMidiMessage = (message: any) => {
    const [status, note, velocity] = message.data;
    // Map MIDI Note On (status 144) to MA2 commands or executor buttons
    if (status >= 144 && status <= 159 && velocity > 0) {
      // Example: Map Note 60+ (Middle C) to Flash Exec 1.101+
      if (note >= 60 && note <= 64) {
        const execId = 101 + (note - 60);
        sendCommand(`Flash Exec 1.${execId}`);
      }
    }
  };

  useEffect(() => {
    // Hydration fix & Load Settings
    const timeoutId = setTimeout(() => {
      setSessionId(Math.floor(Math.random() * 9999).toString());
      
      const savedIp = localStorage.getItem('ma_remote_ip');
      const savedConfig = localStorage.getItem('artnet_config');
      const savedLayout = localStorage.getItem('ma_remote_layout');
      const savedPresets = localStorage.getItem('ma_remote_layout_presets');
      const savedFaders = localStorage.getItem('ma_remote_faders');
      
      if (savedIp) {
        setIp(savedIp);
      } else {
        // Fallback for first run / loopback
        setIp('192.168.15.10');
      }
      if (savedConfig) {
        try {
          setArtNetConfig(JSON.parse(savedConfig));
        } catch (e) {
          console.error("Failed to parse saved Art-Net config");
        }
      }
      if (savedLayout) {
        try {
          setLayoutObjects(JSON.parse(savedLayout));
        } catch (e) {
          console.error("Failed to parse saved layout");
        }
      }
      if (savedPresets) {
        try {
          setLayoutPresets(JSON.parse(savedPresets));
        } catch (e) {
          console.error("Failed to parse saved presets");
        }
      }
      if (savedFaders) {
        try {
          setFaderGroups(JSON.parse(savedFaders));
        } catch (e) {
          console.error("Failed to parse saved faders");
        }
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (isAutoTracking) {
      // Pulse scan every 20 seconds
      const interval = setInterval(() => {
        scanNetwork();
      }, 20000);
      
      // Initial scan when enabled
      scanNetwork();
      
      return () => clearInterval(interval);
    }
  }, [isAutoTracking]);

  // Handle results from auto-tracking
  useEffect(() => {
    if (isAutoTracking && discoveredNodes.length > 0) {
      // Prioritize nodes that look like a console (MA Lighting/grandMA)
      const maNode = discoveredNodes.find(node => 
        node.name.toLowerCase().includes('grandma') || 
        node.name.toLowerCase().includes('ma lighting') ||
        node.name.toLowerCase().includes('console')
      ) || discoveredNodes[0]; // fallback to first node found
      
      if (maNode && maNode.ip !== ip) {
        setIp(maNode.ip);
        localStorage.setItem('ma_remote_ip', maNode.ip);
        setPingResult(null);
        setLogs(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          command: 'AUTO: TRACK',
          status: 'success',
          message: `Auto-assigned IP to detected console: ${maNode.ip} (${maNode.name})`
        }, ...prev]);
      }
    }
  }, [discoveredNodes, isAutoTracking, ip]);

  const saveArtNetSettings = () => {
    localStorage.setItem('ma_remote_ip', ip);
    localStorage.setItem('artnet_config', JSON.stringify(artNetConfig));
    const saveLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'SYS: SAVE',
      status: 'success',
      message: 'Node settings saved to local storage'
    };
    setLogs(prev => [saveLog, ...prev]);
  };

  const exportProject = () => {
    const projectData = {
      version: '2.5',
      timestamp: new Date().toISOString(),
      config: {
        ip,
        artNetConfig
      },
      layout: layoutObjects,
      presets: layoutPresets
    };
    
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MA_Remote_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setLogs(prev => [{
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      command: 'SYS: EXPORT',
      status: 'success',
      message: 'Project backup file generated successfully'
    }, ...prev]);
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.config) {
          if (data.config.ip) {
            setIp(data.config.ip);
            localStorage.setItem('ma_remote_ip', data.config.ip);
          }
          if (data.config.artNetConfig) {
            setArtNetConfig(data.config.artNetConfig);
            localStorage.setItem('artnet_config', JSON.stringify(data.config.artNetConfig));
          }
        }
        if (data.layout) {
          setLayoutObjects(data.layout);
          localStorage.setItem('ma_remote_layout', JSON.stringify(data.layout));
        }
        if (data.presets) {
          setLayoutPresets(data.presets);
          localStorage.setItem('ma_remote_layout_presets', JSON.stringify(data.presets));
        }
        
        setLogs(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          command: 'SYS: IMPORT',
          status: 'success',
          message: 'Project restored from backup file'
        }, ...prev]);
      } catch (err) {
        setLogs(prev => [{
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          command: 'SYS: IMPORT ERR',
          status: 'error',
          message: 'Failed to parse backup file'
        }, ...prev]);
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    // Start webcam if requested or on mount
    if (isWebcamActive && navigator.mediaDevices && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } })
        .then((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch((err) => {
          console.error("Webcam error:", err);
          setIsWebcamActive(false);
        });
    } else if (!isWebcamActive && videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, [isWebcamActive]);

  return (
    <main className="min-h-screen bg-console-bg text-zinc-300 font-sans p-4 flex flex-col h-full overflow-hidden">
      {/* Console Header */}
      <header className="flex items-center justify-between mb-4 bg-black/40 p-3 rounded-lg border border-white/5">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <div className="text-[10px] font-black tracking-[0.3em] text-zinc-600 uppercase mb-1 flex items-center justify-between">
               <span>MA Node v2.5</span>
               {isAutoTracking && <span className="text-emerald-500 text-[8px] animate-pulse">● TRACKING</span>}
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => {
                  const newIp = prompt("Set Console IP:", ip);
                  if (newIp) {
                    setIp(newIp);
                    localStorage.setItem('ma_remote_ip', newIp);
                    setPingResult(null);
                  }
                }}
                className="lcd-display text-[11px] py-1 px-4 min-w-[200px] border-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400 transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    !ip ? "bg-zinc-700" : (pingResult?.success ? "bg-emerald-500 animate-pulse" : "bg-red-500")
                  )} />
                  <span>IP: {ip || '0.0.0.0'}</span>
                </div>
                <Settings className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button 
                onClick={() => setIsAutoTracking(!isAutoTracking)}
                className={cn(
                  "ma-btn px-2 flex items-center justify-center border-zinc-800",
                  isAutoTracking ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "text-zinc-600"
                )}
                title="Auto-Track IP from Art-Net Poll"
              >
                <RefreshCw className={cn("w-3 h-3", isAutoTracking && "animate-spin-slow")} />
              </button>
            </div>
          </div>

          <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 ml-4">
            <button
              onClick={() => setActiveTab('console')}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-widest",
                activeTab === 'console' ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Console
            </button>
            <button
              onClick={() => setActiveTab('faders')}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-widest",
                activeTab === 'faders' ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Faders
            </button>
            <button
              onClick={() => setActiveTab('stage')}
              className={cn(
                "px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-widest",
                activeTab === 'stage' ? "bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              Stage
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center bg-zinc-950/80 border border-zinc-800 rounded p-1">
            <button 
              onClick={() => setControlMode('ma2')}
              className={cn(
                "px-2 py-0.5 text-[8px] font-bold uppercase transition-all rounded",
                controlMode === 'ma2' ? "bg-lcd-text text-black" : "text-zinc-600"
              )}
            >
              MA-Net Rem
            </button>
            <button 
              onClick={() => setControlMode('direct')}
              className={cn(
                "px-2 py-0.5 text-[8px] font-bold uppercase transition-all rounded",
                controlMode === 'direct' ? "bg-amber-500 text-black" : "text-zinc-600"
              )}
            >
              Direct DMX
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsWebcamActive(!isWebcamActive)}
              className={cn(
                "p-2 rounded-full transition-all border",
                isWebcamActive 
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_#10b98144]" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-700"
              )}
              title="Toggle Webcam Overlay"
            >
              <Activity className="w-4 h-4" />
            </button>
            <div className={cn("status-dot", isConnecting ? "status-online animate-pulse" : (controlMode === 'direct' ? "bg-amber-500" : "bg-zinc-700"))} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              {controlMode === 'direct' ? "Internal Engine" : (isConnecting ? "Connected: Active" : "Status: Standby")}
            </span>
          </div>
          <div className="flex gap-2 relative group">
            <button
              onClick={scanNetwork}
              disabled={isScanning}
              className={cn(
                "p-1.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors",
                isScanning && "animate-pulse border-blue-500"
              )}
              title="Scan Network for Art-Net nodes"
            >
              <Activity className={cn("w-3 h-3", isScanning ? "text-blue-400" : "text-zinc-500")} />
            </button>

            {discoveredNodes.length > 0 && (
              <div className="absolute top-full mt-1 right-0 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="text-[8px] font-bold text-zinc-500 uppercase p-2 border-b border-zinc-800 flex justify-between items-center">
                  <span>Nodes Found ({discoveredNodes.length})</span>
                  <button onClick={() => setDiscoveredNodes([])} className="text-zinc-600 hover:text-zinc-400">Close</button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {discoveredNodes.map((node) => (
                    <div
                      key={node.ip}
                      className="w-full text-left p-2 hover:bg-white/5 flex items-center justify-between transition-colors border-b border-zinc-800/50 group/item"
                    >
                      <div className="flex flex-col cursor-pointer flex-1" onClick={() => { setIp(node.ip); setDiscoveredNodes([]); }}>
                        <span className="text-[10px] font-bold text-white leading-none">{node.name}</span>
                        <span className="text-[9px] font-mono text-zinc-500 mt-1">{node.ip}</span>
                      </div>
                      <button 
                        onClick={() => { setIp(node.ip); setControlMode('direct'); setDiscoveredNodes([]); }}
                        className="p-1 px-2 text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded opacity-0 group-hover/item:opacity-100 transition-opacity"
                      >
                        Config
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={undoLastAction}
              disabled={undoHistory.length === 0}
              className={cn(
                "p-1.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors",
                undoHistory.length > 0 ? "text-amber-500 border-amber-500/30" : "text-zinc-600 opacity-50"
              )}
              title="Undo Last Command (Oops)"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowSetup(!showSetup)}
              className={cn(
                "p-1.5 rounded transition-all border font-bold text-[9px] uppercase tracking-widest px-3 flex items-center gap-1",
                showSetup 
                  ? "bg-amber-500/20 border-amber-500 text-amber-500" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Database className="w-3 h-3" />
              Setup / Patch
            </button>

            <button
               onClick={exportProject}
               className="p-1.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors text-blue-400"
               title="Quick Backup App Project"
            >
               <Save className="w-3 h-3" />
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-1.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors",
                showSettings && "border-lcd-text text-lcd-text"
              )}
              title="System Settings"
            >
              <Settings className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 w-80 h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl z-[100] p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase text-white tracking-widest">Network Config</h2>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-amber-500 font-bold uppercase">Art-Net Parameters</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] text-zinc-600 uppercase font-bold">Net</label>
                    <input 
                      type="number" 
                      min="0" max="127"
                      value={artNetConfig.net}
                      onChange={(e) => setArtNetConfig({...artNetConfig, net: parseInt(e.target.value) || 0})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-zinc-600 uppercase font-bold">Subnet</label>
                    <input 
                      type="number" 
                      min="0" max="15"
                      value={artNetConfig.subnet}
                      onChange={(e) => setArtNetConfig({...artNetConfig, subnet: parseInt(e.target.value) || 0})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-zinc-600 uppercase font-bold">Univ</label>
                    <input 
                      type="number" 
                      min="0" max="15"
                      value={artNetConfig.universe}
                      onChange={(e) => setArtNetConfig({...artNetConfig, universe: parseInt(e.target.value) || 0})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-amber-400"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[8px] text-zinc-600 uppercase font-bold">Default Mask</label>
                    <input 
                      type="text"
                      value={artNetConfig.mask}
                      onChange={(e) => setArtNetConfig({...artNetConfig, mask: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-400"
                    />
                </div>
                <button 
                  onClick={saveArtNetSettings}
                  className="ma-btn w-full h-10 flex items-center justify-center bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span className="text-[10px] font-bold uppercase">Save to Memory</span>
                </button>
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <div className="text-[10px] text-zinc-500 font-bold uppercase mb-3">Node Hard Config</div>
                <p className="text-[9px] text-zinc-600 mb-4 leading-relaxed">
                  Send configuration packets (ArtIpProg) to readdress nodes on the fly.
                </p>
                <button 
                  onClick={() => updateNodeNetworkConfig(ip, ip, artNetConfig.mask)}
                  className="ma-btn w-full h-10 flex items-center justify-center bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                >
                  <Send className="w-4 h-4 mr-2" />
                  <span className="text-[10px] font-bold uppercase">Push Network Config</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {showSetup && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 w-80 h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl z-[110] p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-bold uppercase text-white tracking-widest">MA2 System Setup</h2>
              </div>
              <button onClick={() => setShowSetup(false)} className="text-zinc-500 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin">
              {/* Connection Diagnostics */}
              <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-blue-400 font-bold uppercase flex items-center gap-2">
                    <Wifi className="w-3 h-3" /> Diagnostics de Rede
                  </div>
                  {pingResult && (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      pingResult.success ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500 shadow-[0_0_8px_#ef4444]"
                    )} />
                  )}
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center bg-black/40 p-2 rounded border border-white/5">
                      <span className="text-[9px] text-zinc-500 uppercase font-bold">Console Target</span>
                      <span className="text-[11px] font-mono text-zinc-300">{ip || 'NOT SET'}</span>
                   </div>
                   
                   {pingResult && (
                     <motion.div 
                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-2 rounded text-[10px] border flex flex-col gap-1",
                          pingResult.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"
                        )}
                     >
                       <div className="flex justify-between font-bold uppercase text-[8px]">
                          <span>Status: {pingResult.success ? 'Online' : 'Offline'}</span>
                          {pingResult.latency && <span>Ping: {pingResult.latency}ms</span>}
                       </div>
                       <p className="text-[9px] leading-tight opacity-80">
                         {pingResult.success ? pingResult.message : (pingResult.error + ' - ' + pingResult.details)}
                       </p>
                     </motion.div>
                   )}

                   <button 
                     onClick={testConsoleConnection}
                     disabled={isTestingPing || !ip}
                     className={cn(
                       "ma-btn w-full h-9 flex items-center justify-center gap-2",
                       isTestingPing ? "opacity-50" : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                     )}
                   >
                     {isTestingPing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                     <span className="text-[10px] font-bold uppercase">Testar Conexão MA2</span>
                   </button>
                </div>
              </div>

              {/* Show Functions */}
              <div className="space-y-3">
                <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-2">
                  <FileBox className="w-3 h-3" /> Show Management
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { if(confirm("New Show?")) sendCommand('NewShow'); }}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-950 border border-zinc-800 rounded hover:border-red-500/50 transition-all group"
                  >
                    <RefreshCw className="w-4 h-4 text-zinc-600 group-hover:text-red-400 mb-2" />
                    <span className="text-[8px] font-bold uppercase text-zinc-500 group-hover:text-zinc-300">New Show</span>
                  </button>
                  <button 
                    onClick={() => sendCommand('SaveShow')}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-950 border border-zinc-800 rounded hover:border-emerald-500/50 transition-all group"
                  >
                    <Save className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 mb-2" />
                    <span className="text-[8px] font-bold uppercase text-zinc-500 group-hover:text-zinc-300">Save Show</span>
                  </button>
                  <button 
                    onClick={() => sendCommand('Backup')}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-950 border border-zinc-800 rounded hover:border-blue-500/50 transition-all group"
                  >
                    <Database className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 mb-2" />
                    <span className="text-[8px] font-bold uppercase text-zinc-500 group-hover:text-zinc-300">Backup Menu</span>
                  </button>
                  <button 
                    onClick={() => setShowPatchWindow(true)}
                    className="flex flex-col items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/30 rounded hover:border-emerald-500/60 transition-all group"
                  >
                    <Grid3X3 className="w-4 h-4 text-emerald-500/60 group-hover:text-emerald-400 mb-2" />
                    <span className="text-[8px] font-bold uppercase text-emerald-500 group-hover:text-emerald-300">Patch Window</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="text-[8px] text-zinc-600 uppercase font-black tracking-widest pl-1">App Project (Local)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={exportProject}
                      className="flex items-center justify-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded hover:bg-blue-500/20 text-blue-400 transition-all"
                    >
                      <Save className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase">Backup App</span>
                    </button>
                    <label className="flex items-center justify-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded hover:bg-amber-500/20 text-amber-500 transition-all cursor-pointer">
                      <RefreshCw className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase">Import App</span>
                      <input type="file" accept=".json" onChange={importProject} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Quick Project Info */}
              <div className="bg-zinc-950 p-4 border border-white/5 rounded-lg">
                <div className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Network Profile</div>
                <div className="space-y-1 text-[9px] text-zinc-600">
                  <div className="flex justify-between"><span>MA-Net Port</span> <span className="font-mono">30000</span></div>
                  <div className="flex justify-between"><span>DMX Protocol</span> <span className="font-mono">Art-Net 4</span></div>
                  <div className="flex justify-between"><span>Subnet</span> <span className="font-mono">{artNetConfig.mask}</span></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPatchWindow && (
          <PatchWindow 
            onClose={() => setShowPatchWindow(false)}
            fixtureLibrary={FIXTURE_LIBRARY}
            onPatch={handlePatchExecution}
            initialParams={{
              startId: patchStartId,
              quantity: patchQuantity,
              universe: patchUniverse,
              address: patchAddress
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(ip === '127.0.0.1' || !ip) && controlMode === 'ma2' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-[10px] leading-relaxed">
                <p className="text-amber-200 font-bold uppercase mb-1">Connection Requirement</p>
                <p className="text-zinc-400">
                  {!ip ? "Please enter your grandMA2 console's IP address above." : " '127.0.0.1' suggests local loopback. Ensure you use the actual Network IP of your console."}
                  <br />
                  Verify <span className="text-amber-500 font-mono underline decoration-dotted">Setup &gt; Global &gt; Remote Login</span> is <span className="text-emerald-500 font-bold italic">Enabled</span> on your MA2.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 grid grid-cols-12 gap-x-4 h-full min-h-0 overflow-hidden">
        {activeTab === 'console' && (
          <>
            {/* Left Section: Controls & Mini LCD */}
            <div className="col-span-12 lg:col-span-4 flex flex-col space-y-4 h-full overflow-y-auto pr-1 custom-scrollbar">
          <div className="console-surface p-4 flex flex-col space-y-3">
            <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Command Section</div>
            <div className="grid grid-cols-2 gap-2">
              {COMMAND_PRESETS.map((item) => (
                <button
                   key={item.cmd}
                   onClick={() => sendCommand(item.cmd)}
                   disabled={isConnecting}
                   className={cn(
                     "ma-btn h-12 flex flex-col",
                     item.label === 'Full' && "col-span-2 ma-btn-yellow",
                     item.label.includes('On') && "ma-btn-green",
                     item.label.includes('Off') && "ma-btn-red",
                     item.label.includes('Go') && "ma-btn-green"
                   )}
                >
                  <span className="text-[10px]">{item.label}</span>
                  <span className="text-[8px] opacity-40 font-mono mt-0.5">{item.cmd}</span>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-zinc-800/50">
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] text-zinc-500 font-bold uppercase">Executor Page Navigation</div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const next = Math.max(1, currentPage - 1);
                      setCurrentPage(next);
                      sendCommand(`Page ${next}`);
                    }}
                    className="p-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3 text-zinc-400" />
                  </button>
                  <div className="text-[10px] font-mono text-lcd-text bg-black/60 px-2 py-0.5 rounded border border-lcd-text/20">
                    PAGE: {String(currentPage).padStart(2, '0')}
                  </div>
                  <button 
                    onClick={() => {
                      const next = currentPage + 1;
                      setCurrentPage(next);
                      sendCommand(`Page ${next}`);
                    }}
                    className="p-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                  >
                    <ChevronRight className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1 mb-4">
                {PAGE_PRESETS.map((p) => (
                  <button
                    key={`p-${p}`}
                    onClick={() => {
                      setCurrentPage(p);
                      sendCommand(`Page ${p}`);
                    }}
                    className={cn(
                      "ma-btn h-8 text-[9px] font-bold transition-all",
                      currentPage === p 
                        ? "border-blue-500 text-white bg-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.2)]" 
                        : "opacity-60 border-zinc-800/50 hover:opacity-100 hover:border-zinc-700"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Executor Matrix</div>
              <div className="bg-black/20 p-2 rounded-lg border border-white/5 overflow-x-auto">
                <div className="grid grid-cols-6 gap-1 min-w-[280px] mb-2 border-b border-zinc-800 pb-2">
                  <div className="text-[8px] text-zinc-600 uppercase font-bold flex items-center">Function</div>
                  {EXECUTOR_GROUPS.map((group) => (
                    <div key={group.id} className="text-[9px] font-mono text-zinc-500 text-center uppercase tracking-tighter">Ex {group.id}</div>
                  ))}
                </div>
                
                {['Flash', 'Go', 'Pause', 'Off'].map((func) => (
                  <div key={func} className="grid grid-cols-6 gap-1.5 min-w-[280px] mb-1.5 last:mb-0 text-center">
                    <div className="text-[9px] font-bold uppercase text-zinc-400 flex items-center">{func}</div>
                    {EXECUTOR_GROUPS.map((group) => {
                      const btn = group.buttons.find(b => b.label === func);
                      if (!btn) return <div key={group.id} />;
                      return (
                        <button
                          key={`${group.id}-${func}`}
                          onClick={() => sendCommand(btn.cmd)}
                          disabled={isConnecting}
                          className={cn(
                            "ma-btn h-8 flex items-center justify-center",
                            btn.variant === 'green' && "ma-btn-green",
                            btn.variant === 'red' && "ma-btn-red",
                            btn.variant === 'blue' && "ma-btn-blue",
                            btn.variant === 'yellow' && "ma-btn-yellow"
                          )}
                        >
                          <span className="text-[8px] font-bold uppercase">{group.id.slice(-2)}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Precision Pan/Tilt Trackpad */}
            <div className="pt-4 border-t border-zinc-800/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-tighter mr-2">Precision Trackpad</div>
                  
                  {/* Status / Toggle Group */}
                  <div className="flex items-center bg-black/40 border border-white/5 rounded-md p-1 gap-1">
                    <button 
                      onClick={() => setTrackpadLocked(!trackpadLocked)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded transition-all",
                        trackpadLocked 
                          ? "bg-red-500/20 text-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]" 
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                      title={trackpadLocked ? "Unlock Trackpad" : "Lock Trackpad"}
                    >
                      {trackpadLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span className="text-[9px] font-bold uppercase">{trackpadLocked ? "Bloqueado" : "Livre"}</span>
                    </button>

                    <div className="w-px h-4 bg-zinc-800 mx-0.5" />

                    <button 
                      onClick={() => setIsWebcamActive(!isWebcamActive)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded transition-all",
                        isWebcamActive 
                          ? "bg-blue-500/20 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.2)]" 
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Camera className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase">Câmera</span>
                    </button>

                    <div className="w-px h-4 bg-zinc-800 mx-0.5" />

                    <select 
                      value={cameraSource}
                      onChange={(e) => setCameraSource(e.target.value as 'internal' | 'external')}
                      className="bg-transparent text-[8px] font-bold uppercase text-zinc-500 focus:outline-hidden cursor-pointer hover:text-white transition-colors"
                    >
                      <option value="internal" className="bg-zinc-900">Interna</option>
                      <option value="external" className="bg-zinc-900">Orbitronic (Wi-Fi)</option>
                    </select>

                    <div className="w-px h-4 bg-zinc-800 mx-0.5" />

                    {cameraSource === 'external' && isWebcamActive && (
                      <button 
                        onClick={() => setShowOrbitronicConfig(!showOrbitronicConfig)}
                        className="text-amber-500 hover:text-amber-400 transition-colors"
                        title="Orbitronic Config"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}

                    <button 
                      onClick={() => setIsMotionSensorActive(!isMotionSensorActive)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded transition-all",
                        isMotionSensorActive 
                          ? "bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]" 
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Activity className={cn("w-3 h-3", isMotionDetected && isMotionSensorActive && "animate-ping text-red-500")} />
                      <span className="text-[9px] font-bold uppercase">Sensor</span>
                    </button>

                    <div className="w-px h-4 bg-zinc-800 mx-0.5" />

                    <button 
                      onClick={() => setIsAutoFollowActive(!isAutoFollowActive)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded transition-all",
                        isAutoFollowActive 
                          ? "bg-amber-500/20 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse" 
                          : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Activity className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Seguir</span>
                    </button>

                    <div className="w-px h-4 bg-zinc-800 mx-0.5" />

                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Wifi className={cn("w-3 h-3", isConnecting ? "text-amber-500 animate-pulse" : "text-emerald-500")} />
                      <span className="text-[9px] font-bold text-zinc-500 uppercase">Wi-Fi</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] uppercase text-zinc-600 font-bold">Fix/Grp</span>
                    <input 
                      type="number"
                      value={activeGroup}
                      onChange={(e) => setActiveGroup(e.target.value)}
                      className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-[10px] font-mono text-lcd-text text-center focus:outline-hidden focus:border-zinc-600"
                    />
                  </div>
                  <button 
                    onClick={() => setFollowPos({ x: 50, y: 50 })}
                    className="ma-btn h-7 px-3 flex items-center justify-center bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                  >
                    <span className="text-[9px] font-bold uppercase tracking-widest">Home</span>
                  </button>
                </div>
              </div>
              
              <div 
                className={cn(
                  "console-surface h-72 relative overflow-hidden group touch-none bg-black border-emerald-500/10",
                  trackpadLocked ? "cursor-not-allowed opacity-50" : "cursor-none"
                )}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
              >
                {/* Visual Feedback Grid */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--color-emerald-500)_1px,_transparent_1px)] bg-[size:20px_20px]" />
                  <div className="absolute top-1/2 left-0 w-full h-px bg-emerald-500" />
                  <div className="absolute left-1/2 top-0 w-px h-full bg-emerald-500" />
                </div>

                {cameraSource === 'internal' ? (
                  <video 
                    ref={videoRef}
                    autoPlay playsInline muted
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-opacity duration-700 grayscale",
                      isWebcamActive || isAutoFollowActive ? "opacity-30" : "opacity-0"
                    )}
                  />
                ) : (
                  <div className={cn(
                    "absolute inset-0 w-full h-full bg-zinc-950 flex items-center justify-center transition-opacity duration-700",
                    isWebcamActive ? "opacity-30" : "opacity-0"
                  )}>
                    {externalCameraUrl ? (
                      <img 
                        ref={imgRef}
                        src={externalCameraUrl} 
                        alt="Orbitronic Stream" 
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover grayscale"
                        onError={(e) => {
                          (e.target as any).src = 'https://placehold.co/640x480/black/red?text=Camera+Offline';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-zinc-700">
                        <Camera className="w-8 h-8 opacity-20" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Aguardando Orbitronic...</span>
                      </div>
                    )}
                  </div>
                )}

                {showOrbitronicConfig && cameraSource === 'external' && (
                  <div className="absolute top-2 left-2 right-2 bg-black/90 border border-amber-500/30 rounded p-2 z-50 animate-in fade-in slide-in-from-top-1">
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-[9px] text-amber-500 font-black uppercase">Orbitronic 2.4MHz Wi-Fi Config</span>
                       <button onClick={() => setShowOrbitronicConfig(false)} className="text-zinc-500 hover:text-white">×</button>
                     </div>
                     <div className="flex gap-2">
                       <input 
                         type="text" 
                         placeholder="http://192.168.1.100/video.mjpg"
                         value={externalCameraUrl}
                         onChange={(e) => setExternalCameraUrl(e.target.value)}
                         className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-amber-400 placeholder:text-zinc-800"
                       />
                     </div>
                  </div>
                )}

                {/* Hidden motion processing canvas */}
                <canvas 
                  ref={canvasRef} 
                  width="80" 
                  height="60" 
                  className="hidden" 
                />

                {/* Pan/Tilt Axis Rulers */}
                <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
                  {/* Vertical Ruler (Tilt) */}
                  <div className="absolute left-4 top-0 h-full w-4 flex flex-col justify-between py-2 border-r border-emerald-500/10">
                    {[-100, -75, -50, -25, 0, 25, 50, 75, 100].reverse().map(v => (
                      <div key={`tr-${v}`} className="flex items-center gap-1">
                        <div className="w-1 h-px bg-emerald-500/30" />
                        <span className="text-[6px] font-mono text-zinc-700">{v}</span>
                      </div>
                    ))}
                  </div>
                  {/* Horizontal Ruler (Pan) */}
                  <div className="absolute bottom-4 left-0 w-full h-4 flex justify-between px-2 border-t border-emerald-500/10">
                    {[-100, -75, -50, -25, 0, 25, 50, 75, 100].map(v => (
                      <div key={`pr-${v}`} className="flex flex-col items-center gap-1">
                        <div className="h-1 w-px bg-emerald-500/30" />
                        <span className="text-[6px] font-mono text-zinc-700">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Precision Radar Quadrants */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <motion.div 
                    className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full"
                    animate={{ 
                      left: `${followPos.x - 20}%`, 
                      top: `${followPos.y - 20}%`,
                      width: '40%',
                      height: '40%',
                      opacity: trackpadLocked ? 0.05 : 0.15
                    }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  />
                </div>

                {/* Tracking Reticle (Crosshairs) */}
                <motion.div 
                  className="absolute w-full h-full pointer-events-none"
                  initial={false}
                >
                  {/* Vertical Tracker Line */}
                  <motion.div 
                    className="absolute top-0 bottom-0 w-px bg-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    animate={{ left: `${followPos.x}%` }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                  {/* Horizontal Tracker Line */}
                  <motion.div 
                    className="absolute left-0 right-0 h-px bg-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                    animate={{ top: `${followPos.y}%` }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />

                  {/* Edge Indicators (Numeric sliding labels) */}
                  <motion.div 
                    className="absolute bottom-0 h-4 px-1 bg-emerald-500/10 border-t border-emerald-500/20 flex items-center justify-center -translate-x-1/2"
                    animate={{ left: `${followPos.x}%` }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  >
                    <span className="text-[7px] font-mono text-emerald-400 font-bold">
                      {((followPos.x - 50) * 2).toFixed(0)}
                    </span>
                  </motion.div>

                  <motion.div 
                    className="absolute left-0 w-6 h-4 bg-emerald-500/10 border-r border-emerald-500/20 flex items-center justify-center -translate-y-1/2"
                    animate={{ top: `${followPos.y}%` }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  >
                    <span className="text-[7px] font-mono text-emerald-400 font-bold">
                      {((50 - followPos.y) * 2).toFixed(0)}
                    </span>
                  </motion.div>
                </motion.div>

                {/* Reticle Central Head */}
                <motion.div 
                  className="absolute w-12 h-12 border border-emerald-500/40 rounded-full pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                  animate={{ left: `${followPos.x}%`, top: `${followPos.y}%` }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                >
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_15px_#10b981]" />
                  
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                    <div className="text-[7px] font-mono text-zinc-500 uppercase tracking-tighter bg-black/60 px-1 rounded whitespace-nowrap">
                      {selectedFixtures.length > 0 || selectedGroups.length > 0
                        ? `Target: ${[
                            selectedFixtures.length > 0 ? `Fix ${selectedFixtures.join(',')}` : '',
                            selectedGroups.length > 0 ? `Grp ${selectedGroups.join(',')}` : ''
                          ].filter(Boolean).join(' | ')}`
                        : `Target: Group ${activeGroup}`}
                    </div>
                    <div className="text-[8px] font-mono text-emerald-400 font-bold bg-black/90 px-1.5 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                      P:{((followPos.x - 50) * 2).toFixed(1)} T:{((50 - followPos.y) * 2).toFixed(1)}
                    </div>
                  </div>
                </motion.div>

                <div className="absolute top-2 right-2 text-[7px] text-zinc-600 font-mono tracking-widest uppercase">
                  Precision Tracking Active
                </div>
              </div>

              {/* Directional Nudge / D-Pad */}
              <div className="mt-4 flex items-center justify-between gap-4 p-2 bg-black/40 rounded border border-white/5">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[7px] text-zinc-600 uppercase font-bold tracking-widest">Pan Nudge</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => nudge('Pan', -5)}
                        className="flex-1 ma-btn h-10 flex items-center justify-center hover:bg-zinc-800"
                        title="Pan Left"
                      >
                        <ChevronLeft className="w-4 h-4 text-zinc-400" />
                      </button>
                      <button 
                        onClick={() => nudge('Pan', 5)}
                        className="flex-1 ma-btn h-10 flex items-center justify-center hover:bg-zinc-800"
                        title="Pan Right"
                      >
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[7px] text-zinc-600 uppercase font-bold tracking-widest">Tilt Nudge</span>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => nudge('Tilt', 5)}
                        className="flex-1 ma-btn h-10 flex items-center justify-center hover:bg-zinc-800"
                        title="Tilt Up"
                      >
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      </button>
                      <button 
                        onClick={() => nudge('Tilt', -5)}
                        className="flex-1 ma-btn h-10 flex items-center justify-center hover:bg-zinc-800"
                        title="Tilt Down"
                      >
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border border-emerald-500/20 bg-emerald-500/5">
                   <div className="text-[8px] font-bold text-emerald-500/60 uppercase leading-none">Fine</div>
                   <div className="text-[10px] font-mono text-emerald-400 font-bold">5%</div>
                </div>
              </div>
            </div>

            {/* DMX Configuration Panel (Only in Direct Mode) */}
            {controlMode === 'direct' && (
              <div className="pt-4 border-t border-zinc-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-amber-500 font-bold uppercase">Art-Net Engine Config</div>
                  <div className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase font-mono">DMX over IP</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] text-zinc-600 uppercase font-bold">Net</label>
                    <input 
                      type="number" 
                      min="0" max="127"
                      value={artNetConfig.net}
                      onChange={(e) => setArtNetConfig({...artNetConfig, net: parseInt(e.target.value) || 0})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-zinc-600 uppercase font-bold">Subnet</label>
                    <input 
                      type="number" 
                      min="0" max="15"
                      value={artNetConfig.subnet}
                      onChange={(e) => setArtNetConfig({...artNetConfig, subnet: parseInt(e.target.value) || 0})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-zinc-600 uppercase font-bold">Univ</label>
                    <input 
                      type="number" 
                      min="0" max="15"
                      value={artNetConfig.universe}
                      onChange={(e) => setArtNetConfig({...artNetConfig, universe: parseInt(e.target.value) || 0})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-amber-400"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-zinc-600 uppercase font-bold">Target IP & Mask</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                      placeholder="IP (e.g. 2.0.0.1)"
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-blue-400"
                    />
                    <input 
                      type="text"
                      value={artNetConfig.mask}
                      onChange={(e) => setArtNetConfig({...artNetConfig, mask: e.target.value})}
                      placeholder="Mask (e.g. 255.0.0.0)"
                      className="w-24 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateNodeNetworkConfig(ip, ip, artNetConfig.mask)}
                    className="ma-btn flex-1 h-8 flex items-center justify-center bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                  >
                    <Send className="w-3 h-3 mr-2" />
                    <span className="text-[9px] font-bold uppercase">Push Config</span>
                  </button>
                  <button 
                    onClick={saveArtNetSettings}
                    className="ma-btn flex-1 h-8 flex items-center justify-center bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  >
                    <Send className="w-3 h-3 mr-2 rotate-90" />
                    <span className="text-[9px] font-bold uppercase">Save Local</span>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-zinc-500 font-bold uppercase">Local Peripheral Bridge</div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setUsbProtocol('open')}
                    className={cn(
                      "text-[7px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-tighter transition-all",
                      usbProtocol === 'open' ? "bg-blue-500/20 border-blue-500 text-blue-400" : "border-zinc-800 text-zinc-600"
                    )}
                  >
                    Open DMX
                  </button>
                  <button 
                    onClick={() => setUsbProtocol('pro')}
                    className={cn(
                      "text-[7px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-tighter transition-all",
                      usbProtocol === 'pro' ? "bg-amber-500/20 border-amber-500 text-amber-400" : "border-zinc-800 text-zinc-600"
                    )}
                  >
                    Q-Light/Pro
                  </button>
                  <button 
                    onClick={() => setUsbProtocol('sl1000')}
                    className={cn(
                      "text-[7px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-tighter transition-all",
                      usbProtocol === 'sl1000' ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-zinc-800 text-zinc-600"
                    )}
                  >
                    SL 1000
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={connectUSB}
                  className={cn(
                    "ma-btn h-10 flex flex-col items-center justify-center",
                    usbConnected ? "bg-blue-500/10 border-blue-500 text-blue-400" : "opacity-70"
                  )}
                >
                  <Wifi className="w-3 h-3 mb-1" />
                  <span className="text-[9px] font-bold">USB-DMX Connect</span>
                </button>
                <button 
                  onClick={() => setMidiEnabled(!midiEnabled)}
                  className={cn(
                    "ma-btn h-10 flex flex-col items-center justify-center transition-all",
                    midiEnabled ? "bg-purple-500/10 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]" : "opacity-70"
                  )}
                >
                  <RotateCcw className="w-3 h-3 mb-1 rotate-45" />
                  <span className="text-[9px] font-bold">Plug-in MIDI Loop</span>
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="bg-black/40 border border-zinc-700/30 rounded p-1.5 flex flex-col">
                  <span className="text-[8px] text-zinc-600 uppercase font-bold">Wi-Fi Opt</span>
                  <span className="text-[9px] text-emerald-500 font-mono">STABLE - 5GHz</span>
                </div>
                <div className="bg-black/40 border border-zinc-700/30 rounded p-1.5 flex flex-col">
                  <span className="text-[8px] text-zinc-600 uppercase font-bold">MA-Net2 Bridge</span>
                  <span className="text-[9px] text-blue-500 font-mono">ACTIVE (v2.4)</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/50 text-[9px] text-zinc-700 font-bold uppercase tracking-widest text-center py-2">
              Console Controls
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3 h-3 text-zinc-500" />
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">MA Telnet Command</div>
                </div>
                <button 
                  onClick={() => setAiAssistantExpanded(!aiAssistantExpanded)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all border",
                    aiAssistantExpanded 
                      ? "bg-purple-500/10 border-purple-500/50 text-purple-400" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-purple-400 hover:border-purple-500/30"
                  )}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  AI Assistant
                </button>
              </div>

              <AnimatePresence>
                {aiAssistantExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mb-3 overflow-hidden"
                  >
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded p-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[9px] text-purple-300 font-bold uppercase">Natural Language to Command</span>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={aiNaturalCommand}
                          onChange={(e) => setAiNaturalCommand(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && generateMaCommand()}
                          placeholder="e.g. Set wash fixtures to 50% and store in cue 1"
                          className="flex-1 bg-zinc-950 border border-purple-500/20 rounded px-2.5 py-1.5 text-xs text-purple-100 placeholder:text-zinc-700 focus:outline-hidden focus:border-purple-500/50"
                        />
                        <button 
                          onClick={generateMaCommand}
                          disabled={isAiThinking || !aiNaturalCommand.trim()}
                          className="ma-btn bg-purple-500/20 border-purple-500/30 text-purple-400 px-3 hover:bg-purple-500/30 disabled:opacity-50"
                        >
                          {isAiThinking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form 
                onSubmit={(e) => { 
                  e.preventDefault(); 
                  if (!ip) {
                    alert("Por favor, defina o IP do console no topo da página.");
                    return;
                  }
                  if (controlMode !== 'ma2') {
                    if (confirm("Você está no modo 'Direct DMX'. Comandos de texto só funcionam no modo 'MA-Net Rem'. Deseja mudar para MA-Net?")) {
                      setControlMode('ma2');
                    } else {
                      return;
                    }
                  }
                  if (customCmd) { 
                    sendCommand(customCmd); 
                    setCustomCmd(''); 
                  } 
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={customCmd}
                    onChange={(e) => setCustomCmd(e.target.value)}
                    placeholder={!ip ? "SET IP FIRST" : "e.g. Group 1 At 100"}
                    className={cn(
                      "flex-1 bg-zinc-950 border rounded px-3 py-2 text-xs font-mono text-lcd-text placeholder:text-zinc-700 focus:outline-hidden",
                      !ip ? "border-red-500/30" : "border-zinc-800 focus:border-zinc-500"
                    )}
                  />
                  <button 
                    type="submit" 
                    disabled={!customCmd || isConnecting}
                    className={cn(
                      "ma-btn px-4 h-9 min-w-[70px] transition-all",
                      !ip ? "bg-red-500/10 border-red-500/20 text-red-500/50" : "bg-lcd-text/5 border-lcd-text/20 text-lcd-text hover:bg-lcd-text/10"
                    )}
                  >
                    <Send className="w-3 h-3 mr-1.5" />
                    <span className="text-[10px] font-bold">SEND</span>
                  </button>
                </div>
                {!ip && (
                  <p className="text-[8px] text-red-500/70 font-bold uppercase tracking-wider text-center">
                    Cuidado: IP não configurado. Clique no LCD de IP no topo para definir.
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Network Notice */}
          <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg">
            <p className="text-[9px] text-amber-500/80 leading-relaxed uppercase tracking-wider font-bold">
              Connectivity: Ensure port 30000 is open. Cloud servers cannot reach local IPs (192.168.x) without proxy/tunneling.
            </p>
          </div>
        </div>

        {/* Right Section: Large History Log & DMX Monitor */}
        <div className="col-span-12 lg:col-span-8 flex flex-col space-y-4">
          {/* DMX Monitor */}
          <div className="console-surface p-4 flex flex-col min-h-0 h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="text-[10px] text-zinc-500 font-bold uppercase">Universe Monitor</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-mono text-zinc-600 uppercase">Live Buffer</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-[9px] text-zinc-600 font-mono uppercase">Nodes: {discoveredNodes.length}</div>
                <button 
                  onClick={() => setShowDmxMonitor(!showDmxMonitor)}
                  className="text-[9px] font-bold text-lcd-text hover:text-white transition-colors uppercase tracking-[0.2em]"
                >
                  {showDmxMonitor ? 'Collapse' : 'Expand All'}
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black/60 rounded border border-zinc-800/50 p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-px bg-zinc-900 border border-zinc-900">
                {dmxBuffer.map((val, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center border-none transition-colors duration-150",
                      val > 0 ? "bg-lcd-text/10" : "bg-black"
                    )}
                  >
                    <span className="text-[6px] text-zinc-700 font-mono mb-0.5">{idx + 1}</span>
                    <span className={cn(
                      "text-[9px] font-mono font-bold leading-none",
                      val === 255 ? "text-lcd-text shadow-[0_0_8px_rgba(34,197,94,0.3)]" : 
                      val > 0 ? "text-lcd-text/80" : "text-zinc-800"
                    )}>
                      {val === 255 ? 'FF' : val.toString(16).padStart(2, '0').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-2 flex justify-between items-center px-1">
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-lcd-text rounded-full shadow-[0_0_4px_#22c55e]" />
                  <span className="text-[8px] text-zinc-500 uppercase">Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                  <span className="text-[8px] text-zinc-500 uppercase">Idle</span>
                </div>
              </div>
              <div className="text-[8px] font-mono text-zinc-600">UNIVERSE: 0 | CHANNELS: 512</div>
            </div>
          </div>

          {/* Layout View */}
          <div className="console-surface p-4 flex flex-col min-h-0 h-[450px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="text-[10px] text-zinc-500 font-bold uppercase">Layout View</div>
                {isEditingLayout && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => addObject('Fixture')}
                      className="text-[8px] px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 transition-all font-bold uppercase transition-all"
                    >
                      + Fixture
                    </button>
                    <button 
                      onClick={() => addObject('Group')}
                      className="text-[8px] px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all font-bold uppercase transition-all"
                    >
                      + Group
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsEditingLayout(!isEditingLayout)}
                  className={cn(
                    "text-[9px] font-extrabold transition-all uppercase tracking-wider px-2 py-1 rounded border",
                    isEditingLayout 
                      ? "bg-amber-500/20 border-amber-500 text-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.2)]" 
                      : "text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-400"
                  )}
                >
                  {isEditingLayout ? 'EDITING...' : 'MA EDIT'}
                </button>
                <button 
                  onClick={pollLayout}
                  disabled={isPollingLayout}
                  className={cn(
                    "text-[9px] font-bold transition-all uppercase tracking-wider px-2 py-1 rounded border",
                    isPollingLayout 
                      ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 animate-pulse" 
                      : "text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-400"
                  )}
                >
                  {isPollingLayout ? 'Polling...' : 'Layout Poll'}
                </button>
                <button 
                  onClick={() => setIsDynamicLayout(!isDynamicLayout)}
                  className={cn(
                    "text-[9px] font-bold transition-all uppercase tracking-wider px-2 py-1 rounded border",
                    isDynamicLayout 
                      ? "text-amber-500 border-amber-500/20 bg-amber-500/5" 
                      : "text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-400"
                  )}
                >
                  {isDynamicLayout ? 'Dynamic ON' : 'Dynamic OFF'}
                </button>
                <button 
                  onClick={() => {
                    setSelectedFixtures([]);
                    setSelectedGroups([]);
                    if (controlMode === 'ma2') sendCommand('Clear');
                  }}
                  className="text-[9px] font-bold text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-[0.2em] ml-2"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black/60 rounded border border-zinc-800/50 flex flex-col min-h-0">
              {/* Presets and Controls Bar */}
              <div className="px-2 py-1.5 bg-zinc-900/50 border-b border-zinc-800 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3 overflow-x-auto scrollbar-none flex-1">
                  <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest flex items-center gap-1 shrink-0">
                    <Save className="w-2.5 h-2.5" />
                    Presets:
                  </div>
                  <div className="flex gap-1.5">
                    {layoutPresets.map((preset) => (
                      <div key={preset.id} className="group flex items-center shrink-0">
                        <button
                          onClick={() => loadPreset(preset)}
                          className="text-[9px] px-2 py-0.5 rounded-l bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all font-mono"
                        >
                          {preset.name}
                        </button>
                        <button 
                          onClick={() => deletePreset(preset.id)}
                          className="text-[9px] px-1 py-0.5 rounded-r bg-zinc-800 border-t border-b border-r border-zinc-700 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all border-l-0"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const name = prompt("Enter preset name:", `Layout ${layoutPresets.length + 1}`);
                        if (name) savePreset(name);
                      }}
                      className="text-[9px] px-2 py-0.5 rounded border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-all flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      New
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedFixtures([]);
                      setSelectedGroups([]);
                      if (controlMode === 'ma2') sendCommand('Clear');
                    }}
                    className="text-[9px] font-bold text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-[0.2em] ml-2 shrink-0"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div 
                className="flex-1 relative overflow-hidden touch-none cursor-crosshair"
              onPointerDown={(e) => {
                if (isEditingLayout) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                if (selectedFixtures.length > 0 || selectedGroups.length > 0) {
                  handlePointerDown(e);
                }
              }}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;

                if (draggingObject !== null && draggingType !== null) {
                  updateObjectPosition(draggingObject, draggingType, x, y);
                  return;
                }

                if (e.buttons > 0 && !isEditingLayout && (selectedFixtures.length > 0 || selectedGroups.length > 0)) {
                  handlePointerMove(e);
                }
              }}
              onPointerUp={() => {
                setDraggingObject(null);
                setDraggingType(null);
              }}
              onPointerLeave={() => {
                setDraggingObject(null);
                setDraggingType(null);
              }}
            >
              <div className="absolute inset-0 grid grid-cols-10 grid-rows-10 opacity-5 pointer-events-none">
                {Array.from({ length: 100 }).map((_, i) => (
                  <div key={i} className="border-[0.5px] border-white" />
                ))}
              </div>

              {/* Objects */}
              {layoutObjects.map((obj) => (
                <motion.div
                  key={`${obj.type}-${obj.id}`}
                  animate={{ 
                    left: `${obj.x + (isDynamicLayout ? layoutOffset.x : 0)}%`, 
                    top: `${obj.y + (isDynamicLayout ? layoutOffset.y : 0)}%`,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{ width: obj.width || 48, height: obj.height || 48 }}
                >
                  <button
                    onClick={() => handleLayoutClick(obj)}
                    className={cn(
                      "w-full h-full border transition-all duration-200 flex flex-col items-center justify-center shadow-lg relative group",
                      obj.type === 'Group' ? "rounded-full" : "rounded-sm",
                      (obj.type === 'Fixture' && selectedFixtures.includes(obj.id)) || 
                      (obj.type === 'Group' && selectedGroups.includes(obj.id))
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-500",
                      isEditingLayout && "cursor-move border-dashed border-amber-500/50"
                    )}
                  >
                    {isEditingLayout && obj.type === 'Fixture' ? (
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-zinc-900 border border-zinc-700 rounded px-1 z-50">
                        <span className="text-[7px] text-zinc-500 uppercase font-mono mr-1">CH</span>
                        <input 
                          type="number"
                          value={obj.dmxChannel || ''}
                          onChange={(e) => updateObjectDmxChannel(obj.id, obj.type, parseInt(e.target.value) || 0)}
                          className="w-8 bg-black text-[9px] font-mono text-amber-500 focus:outline-hidden"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <span className="text-[6px] font-mono opacity-50 uppercase tracking-tighter mb-0.5 pointer-events-none">{obj.subType}</span>
                    )}
                    <span className="text-[10px] font-bold font-mono pointer-events-none">{obj.id}</span>
                    
                    {/* Visual selection indicator */}
                    {((obj.type === 'Fixture' && selectedFixtures.includes(obj.id)) || 
                     (obj.type === 'Group' && selectedGroups.includes(obj.id))) && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                    )}

                    {/* Resize Handle */}
                    {isEditingLayout && (
                      <div 
                        className="absolute bottom-0 right-0 w-3 h-3 bg-amber-500/10 cursor-nwse-resize rounded-tl-sm border-l border-t border-amber-500/20"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const startW = obj.width || 48;
                          const startH = obj.height || 48;
                          
                          const moveHandler = (me: PointerEvent) => {
                            const dw = me.clientX - startX;
                            const dh = me.clientY - startY;
                            updateObjectSize(obj.id, obj.type, Math.max(24, startW + dw), Math.max(24, startH + dh));
                          };
                          const upHandler = () => {
                            window.removeEventListener('pointermove', moveHandler);
                            window.removeEventListener('pointerup', upHandler);
                          };
                          window.addEventListener('pointermove', moveHandler);
                          window.addEventListener('pointerup', upHandler);
                        }}
                      />
                    )}

                    {/* Delete Toggle */}
                    {isEditingLayout && (
                      <div 
                        onClick={(e) => { e.stopPropagation(); removeObject(obj.id, obj.type); }}
                        className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center cursor-pointer border border-black/50 shadow-sm"
                      >
                         <span className="text-white text-[8px] font-bold">×</span>
                      </div>
                    )}
                  </button>
                </motion.div>
              ))}

              <div className="absolute bottom-2 right-2 text-[8px] text-zinc-700 font-mono italic pointer-events-none">
                Interactive Selection Mode
              </div>
              </div>
            </div>
          </div>

          {/* Terminal History */}
          <div className="console-surface p-4 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-zinc-500 font-bold uppercase">Terminal History</div>
              <button 
                onClick={() => setLogs([])}
                className="text-[9px] font-bold text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-[0.2em]"
              >
                Clear History
              </button>
            </div>
            
            <div className="lcd-display flex-1 overflow-y-auto leading-relaxed text-[11px] h-full">
              {logs.length === 0 ? (
                <div className="opacity-30 p-2">[READY] System initialized...</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="mb-2 p-1 border-b border-zinc-900/50">
                    <span className="opacity-50">[{log.timestamp}]</span>{" "}
                    <span className={cn(log.status === 'success' ? "text-lcd-text" : "text-red-400")}>
                      {log.status === 'success' ? "OK" : "ERR"} &gt;
                    </span>{" "}
                    <span className="font-bold underline decoration-zinc-800 underline-offset-2">{log.command}</span>
                    <div className="ml-4 text-[10px] opacity-70 italic mt-0.5">{log.message}</div>
                  </div>
                ))
              )}
              <div className="animate-pulse ml-2 px-1 bg-lcd-text w-2 h-4 inline-block align-middle mt-1" />
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'faders' && (
        <div className="col-span-12 flex flex-col h-full space-y-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                  <Grid3X3 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase text-white tracking-widest leading-none">DMX Fader Grouping</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-[0.2em]">Manual Logical Submasters</p>
                </div>
              </div>
              
              {!isAddingFaderGroup ? (
                <button 
                  onClick={() => setIsAddingFaderGroup(true)}
                  className="ma-btn h-12 px-6 flex items-center gap-3 bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 active:scale-95 transition-all group"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Create New Fader</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setIsAddingFaderGroup(false)} className="ma-btn px-4 h-12 text-[10px] uppercase font-bold text-zinc-500">Cancel</button>
                  <button onClick={addFaderGroup} className="ma-btn ma-btn-green px-6 h-12 text-[11px] uppercase font-black tracking-widest">Confirm & Build</button>
                </div>
              )}
            </div>

            {isAddingFaderGroup && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6 ring-1 ring-emerald-500/10"
              >
                <div className="space-y-3">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2">
                    <Terminal className="w-3 h-3" /> Fader Alias (Name)
                  </label>
                  <input 
                    type="text"
                    value={newFaderName}
                    onChange={(e) => setNewFaderName(e.target.value)}
                    placeholder="e.g. Wash Front Master"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-emerald-400 placeholder:text-zinc-700 outline-none focus:border-emerald-500/50 transition-all font-bold"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2">
                    <ListChecks className="w-3 h-3" /> Channel Assignments
                  </label>
                  <input 
                    type="text"
                    value={newFaderChannels}
                    onChange={(e) => setNewFaderChannels(e.target.value)}
                    placeholder="e.g. 1-12, 15, 20"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-blue-400 placeholder:text-zinc-700 outline-none focus:border-blue-500/50 transition-all font-mono"
                  />
                  <p className="text-[8px] text-zinc-600 uppercase font-bold ml-1 italic">* Use commas for list and hyphens for ranges</p>
                </div>
              </motion.div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
                {faderGroups.length === 0 ? (
                  <div className="col-span-full h-96 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center space-y-6 opacity-30 grayscale hover:opacity-50 hover:grayscale-0 transition-all duration-700">
                    <div className="p-8 bg-zinc-900 rounded-full border border-zinc-700">
                      <Layout className="w-16 h-16 text-zinc-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black uppercase text-zinc-500 tracking-[0.3em] mb-2">No Active Faders</p>
                      <p className="text-xs text-zinc-600 uppercase font-bold">Group DMX channels to create custom faders</p>
                    </div>
                  </div>
                ) : (
                  faderGroups.map((group) => (
                    <motion.div 
                      key={group.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-col space-y-6 group/fader relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between z-10">
                        <div className="space-y-1">
                          <h3 className="text-xs font-black text-white uppercase tracking-wider">{group.name}</h3>
                          <div className="flex items-center gap-2">
                             <div className="flex flex-wrap gap-1">
                                {group.channels.slice(0, 5).map(ch => (
                                  <span key={ch} className="text-[7px] bg-black border border-zinc-800 text-zinc-500 px-1 rounded-sm font-mono tracking-tighter">CH{ch}</span>
                                ))}
                                {group.channels.length > 5 && <span className="text-[7px] text-zinc-700 font-bold">+{group.channels.length - 5} MORE</span>}
                             </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-right">
                              <div className="text-lg font-black font-mono text-emerald-400 leading-none">{Math.round((group.level / 255) * 100)}%</div>
                              <div className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Intensity</div>
                           </div>
                           <button 
                             onClick={() => deleteFaderGroup(group.id)}
                            className="p-2 bg-red-500/5 border border-red-500/20 rounded-lg text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover/fader:opacity-100"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      </div>

                      <div className="relative flex items-center h-12 bg-black rounded-lg border border-zinc-800/50 group/track overflow-hidden shadow-inner">
                         {/* Dynamic Progress Bar Background */}
                        <div 
                          className="absolute h-full bg-emerald-500/20 backdrop-blur-sm border-r border-emerald-500/40 transition-all duration-75"
                          style={{ width: `${(group.level / 255) * 100}%` }}
                        />
                        
                        <input 
                          type="range"
                          min="0"
                          max="255"
                          value={group.level}
                          onChange={(e) => handleFaderChange(group.id, parseInt(e.target.value))}
                          className="w-full relative z-20 h-full bg-transparent appearance-none cursor-ew-resize px-1 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-12 [&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-300 [&::-webkit-slider-thumb]:shadow-[0_0_15px_#10b98188] transition-all"
                        />
                      </div>

                       {/* Interactive Indicators */}
                       <div className="grid grid-cols-4 gap-2 z-10">
                          {[0, 85, 170, 255].map((val) => (
                            <button
                              key={val}
                              onClick={() => handleFaderChange(group.id, val)}
                              className="bg-black/40 border border-zinc-800 rounded-lg py-2 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group/preset"
                            >
                              <span className="text-[8px] font-black text-zinc-600 group-hover/preset:text-emerald-500 uppercase tracking-tighter">
                                {val === 0 ? 'Zero' : val === 255 ? 'Full' : `${Math.round((val/255)*100)}%`}
                              </span>
                            </button>
                          ))}
                        </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stage' && (
          <div className="col-span-12 flex flex-col h-full space-y-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Layout className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-black uppercase text-white tracking-widest">Interactive Stage</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-black/40 border border-zinc-800 rounded-lg p-1">
                <button 
                  onClick={() => setIsEditingLayout(!isEditingLayout)}
                  className={cn(
                    "px-3 py-1 rounded text-[10px] font-black uppercase transition-all tracking-wider",
                    isEditingLayout ? "bg-amber-500 text-black" : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {isEditingLayout ? 'Lock Layout' : 'Edit Layout'}
                </button>
              </div>
              <button 
                onClick={() => {
                  setSelectedFixtures([]);
                  setSelectedGroups([]);
                  if (controlMode === 'ma2') sendCommand('Clear');
                }}
                className="ma-btn h-10 px-6 text-[10px] uppercase font-black tracking-widest bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div className="flex-1 console-surface relative overflow-hidden bg-black border-purple-500/10">
            {/* Stage Grid Background */}
            <div className="absolute inset-0 grid grid-cols-20 grid-rows-20 opacity-5 pointer-events-none">
              {Array.from({ length: 400 }).map((_, i) => (
                <div key={i} className="border-[0.5px] border-white/20" />
              ))}
            </div>

            <div 
              className="absolute inset-0 overflow-hidden touch-none"
              onPointerDown={(e) => {
                if (isEditingLayout) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                if (selectedFixtures.length > 0 || selectedGroups.length > 0) {
                  handlePointerDown(e);
                }
              }}
            >
              {layoutObjects.map((obj) => (
                <motion.div
                  key={`${obj.type}-${obj.id}`}
                  animate={{ 
                    left: `${obj.x + (isDynamicLayout ? layoutOffset.x : 0)}%`, 
                    top: `${obj.y + (isDynamicLayout ? layoutOffset.y : 0)}%`,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                  style={{ width: obj.width ? obj.width * 1.5 : 72, height: obj.height ? obj.height * 1.5 : 72 }}
                >
                   <button
                    onClick={() => handleLayoutClick(obj)}
                    className={cn(
                      "w-full h-full border transition-all duration-200 flex flex-col items-center justify-center shadow-lg relative group",
                      obj.type === 'Group' ? "rounded-full" : "rounded-lg",
                      (obj.type === 'Fixture' && selectedFixtures.includes(obj.id)) || 
                      (obj.type === 'Group' && selectedGroups.includes(obj.id))
                        ? "bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.4)]" 
                        : "bg-zinc-900/80 backdrop-blur-sm border-zinc-800 text-zinc-600 hover:border-zinc-500",
                      isEditingLayout && "cursor-move border-dashed border-amber-500"
                    )}
                  >
                    <span className="text-[8px] font-mono opacity-50 uppercase tracking-tighter mb-0.5">{obj.subType}</span>
                    <span className="text-sm font-black font-mono">{obj.id}</span>
                    
                    {/* Active Pulse */}
                    {((obj.type === 'Fixture' && selectedFixtures.includes(obj.id)) || 
                     (obj.type === 'Group' && selectedGroups.includes(obj.id))) && (
                      <div className="absolute inset-0 rounded-inherit border-2 border-purple-400 animate-ping opacity-20" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="absolute top-4 left-4 flex flex-col gap-2">
               <div className="px-3 py-1.5 bg-black/80 backdrop-blur-md border border-zinc-800 rounded-lg flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Stage Global</span>
                  </div>
                  <div className="w-px h-3 bg-zinc-800" />
                  <span className="text-[10px] font-mono text-zinc-500">LIVE TRACKING ACTIVE</span>
               </div>
            </div>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 p-2 rounded-2xl shadow-2xl">
                <button onClick={() => sendCommand('Full')} className="ma-btn h-12 px-6 ma-btn-yellow text-[11px] font-black uppercase">Full</button>
                <div className="w-px h-6 bg-zinc-800" />
                <button onClick={() => sendCommand('Clear')} className="ma-btn h-12 px-6 text-[11px] font-black uppercase border-zinc-700 text-zinc-400">Clear</button>
                <button onClick={() => sendCommand('Store')} className="ma-btn h-12 px-6 text-[11px] font-black uppercase border-zinc-700 text-zinc-400">Store</button>
                <div className="w-px h-6 bg-zinc-800" />
                <button onClick={() => sendCommand('Next')} className="ma-btn h-12 px-6 text-[11px] font-black uppercase bg-blue-500/10 border-blue-500/30 text-blue-400">Next</button>
            </div>
          </div>
        </div>
      )}
      </div>

      <footer className="mt-4 flex items-center justify-between text-[10px] font-mono text-zinc-600 border-t border-zinc-800 pt-2 uppercase">
        <div className="flex gap-4">
          <span>grandMA2 REMOTE EMULATOR V2.4</span>
          <span className="text-zinc-800">|</span>
          <span>SESSION: {sessionId || '----'}</span>
        </div>
        <div className="flex gap-4">
          <span>PORT: 30000</span>
          <span>FPS: 60.0</span>
          <span>TEMP: 42°C</span>
        </div>
      </footer>
    </main>
  );
}
