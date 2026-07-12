import React, { useState, useEffect } from "react";
import { BookOpen, Play, Star, Trash2, AlertCircle, Volume2, ChevronDown, ChevronRight, CheckSquare, Square } from "lucide-react";
import { getChunks, deleteChunk, getSemanticGroups } from "../db/indexedDb";
import { Chunk, SemanticGroup } from "../types";
import { speakText } from "../utils/tts";

interface MyChunksViewProps {
  onStartPractice: (chunks: Chunk[]) => void;
}

export default function MyChunksView({ onStartPractice }: MyChunksViewProps) {
  const [allChunks, setAllChunks] = useState<Chunk[]>([]);
  const [semanticGroups, setSemanticGroups] = useState<SemanticGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<{ group: SemanticGroup | null, chunks: Chunk[] }[]>([]);
  
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedStarFilter, setSelectedStarFilter] = useState("all");
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allChunks, semanticGroups, selectedLanguage, selectedStarFilter]);

  const loadData = async () => {
    const list = await getChunks();
    const groups = await getSemanticGroups();
    setAllChunks(list);
    setSemanticGroups(groups);
  };

  const applyFilters = () => {
    let resultChunks = [...allChunks];
    if (selectedLanguage !== "all") {
      resultChunks = resultChunks.filter((c) => c.language.toLowerCase() === selectedLanguage.toLowerCase());
    }
    if (selectedStarFilter !== "all") {
      const starVal = parseInt(selectedStarFilter, 10);
      resultChunks = resultChunks.filter((c) => Math.round(c.averageRating || c.stars || 0) === starVal);
    }
    
    // Group chunks by semanticGroupId
    const grouped: Record<string, Chunk[]> = {};
    const unassigned: Chunk[] = [];
    
    resultChunks.forEach(chunk => {
      if (chunk.semanticGroupId) {
        if (!grouped[chunk.semanticGroupId]) grouped[chunk.semanticGroupId] = [];
        grouped[chunk.semanticGroupId].push(chunk);
      } else {
        unassigned.push(chunk);
      }
    });

    const displayGroups: { group: SemanticGroup | null, chunks: Chunk[] }[] = [];
    Object.keys(grouped).forEach(groupId => {
      const group = semanticGroups.find(g => g.id === groupId) || null;
      displayGroups.push({ group, chunks: grouped[groupId] });
    });
    
    if (unassigned.length > 0) {
      displayGroups.push({ group: null, chunks: unassigned });
    }

    setFilteredGroups(displayGroups);
  };

  const handleDeleteChunk = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa chunk này khỏi thư viện?")) {
      await deleteChunk(id);
      loadData();
      
      const newSelected = new Set(selectedChunkIds);
      newSelected.delete(id);
      setSelectedChunkIds(newSelected);
    }
  };

  const toggleGroupSelection = (chunks: Chunk[]) => {
    const newSelected = new Set(selectedChunkIds);
    const allSelected = chunks.every(c => newSelected.has(c.id!));
    chunks.forEach(c => {
      if (allSelected) {
        newSelected.delete(c.id!);
      } else {
        newSelected.add(c.id!);
      }
    });
    setSelectedChunkIds(newSelected);
  };

  const toggleChunkSelection = (id: string) => {
    const newSelected = new Set(selectedChunkIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedChunkIds(newSelected);
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const startCustomPractice = () => {
    const chunksToPractice = allChunks.filter(c => selectedChunkIds.has(c.id!));
    if (chunksToPractice.length > 0) {
      onStartPractice(chunksToPractice);
    }
  };

  const uniqueLanguages = Array.from(new Set(allChunks.map((c) => c.language)));
  const totalChunks = allChunks.length;
  const totalReviews = allChunks.reduce((sum, chunk) => sum + (chunk.totalReviews || chunk.timesPracticed || 0), 0);
  
  const getStarCount = (val: number) => allChunks.filter((c) => Math.round(c.averageRating || c.stars || 0) === val).length;
  
  const starCounts = {
    0: getStarCount(0),
    1: getStarCount(1),
    2: getStarCount(2),
    3: getStarCount(3),
    4: getStarCount(4),
    5: getStarCount(5),
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-pageFadeIn text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <BookOpen className="text-vibrant-indigo" />
            Thư Viện Chunks
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
            Quản lý và tạo danh sách phát (Play List) để luyện tập.
          </p>
        </div>

        {selectedChunkIds.size > 0 && (
          <button
            onClick={startCustomPractice}
            className="flex items-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white px-5 sm:px-6 py-3 rounded-2xl font-black shadow-lg shadow-vibrant-coral/20 transition-all active:scale-95 w-full sm:w-auto justify-center text-xs uppercase tracking-tight cursor-pointer border-none"
          >
            <Play size={16} fill="currentColor" />
            Luyện Tập ({selectedChunkIds.size})
          </button>
        )}
      </div>

      {/* Dashboard Statistics Widget */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 text-left">
        <div className="md:col-span-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số Chunks</span>
            <div className="p-2.5 bg-vibrant-indigo/10 text-vibrant-indigo rounded-xl">
              <BookOpen size={18} />
            </div>
          </div>
          <div>
            <h3 className="font-display text-3xl sm:text-4xl font-black text-vibrant-indigo">{totalChunks}</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">Cụm từ đã lưu trữ trong thiết bị</p>
          </div>
        </div>

        <div className="md:col-span-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đã phát âm</span>
            <div className="p-2.5 bg-vibrant-coral/10 text-vibrant-coral rounded-xl">
              <Volume2 size={18} />
            </div>
          </div>
          <div>
            <h3 className="font-display text-3xl sm:text-4xl font-black text-vibrant-coral">{totalReviews} LẦN</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">Tổng lượt ghi âm phát âm thành công</p>
          </div>
        </div>

        <div className="md:col-span-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-3.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-100">Phân loại số sao</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
            {[5, 4, 3, 2, 1, 0].map((star) => (
              <div key={star} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1 text-slate-500 font-mono">
                  {star > 0 ? (
                    <>
                      <span className="font-black text-slate-700">{star}</span>
                      <Star size={11} className="text-vibrant-yellow" fill="currentColor" />
                    </>
                  ) : (
                    <span className="text-[10px] font-black text-slate-400 uppercase">Chưa luyện</span>
                  )}
                </div>
                <span className="font-bold font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                  {starCounts[star as 0 | 1 | 2 | 3 | 4 | 5]} câu
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 sm:p-5 rounded-[2rem] border border-slate-100 shadow-sm items-center justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer"
          >
            <option value="all">Tất cả ngôn ngữ</option>
            {uniqueLanguages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={selectedStarFilter}
            onChange={(e) => setSelectedStarFilter(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer"
          >
            <option value="all">Tất cả số sao</option>
            <option value="0">Chưa luyện (0 sao)</option>
            <option value="1">1 sao (Yếu)</option>
            <option value="2">2 sao (Khá)</option>
            <option value="3">3 sao (Tốt)</option>
            <option value="4">4 sao (Rất tốt)</option>
            <option value="5">5 sao (Xuất sắc)</option>
          </select>
        </div>
        <button
          onClick={() => {
            const allFilteredChunkIds = filteredGroups.flatMap(g => g.chunks).map(c => c.id!);
            const allSelected = allFilteredChunkIds.every(id => selectedChunkIds.has(id));
            const newSelected = new Set(selectedChunkIds);
            if (allSelected) {
              allFilteredChunkIds.forEach(id => newSelected.delete(id));
            } else {
              allFilteredChunkIds.forEach(id => newSelected.add(id));
            }
            setSelectedChunkIds(newSelected);
          }}
          className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 bg-vibrant-indigo hover:bg-vibrant-indigo/90 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-vibrant-indigo/20 transition-all active:scale-95 text-xs uppercase tracking-tight cursor-pointer border-none"
        >
          {filteredGroups.flatMap(g => g.chunks).map(c => c.id!).every(id => selectedChunkIds.has(id)) && filteredGroups.flatMap(g => g.chunks).length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả đã lọc"}
        </button>
      </div>

      {/* Semantic Groups List */}
      <div className="space-y-6">
        {filteredGroups.map((gObj, idx) => {
          const groupId = gObj.group?.id || "unassigned";
          const groupName = gObj.group?.canonicalMeaning || "Unassigned / Other Chunks";
          const isExpanded = expandedGroups[groupId] ?? true;
          const allSelectedInGroup = gObj.chunks.every(c => selectedChunkIds.has(c.id!));
          
          return (
            <div key={groupId} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              {/* Group Header */}
              <div 
                className="bg-slate-50/50 p-4 sm:p-5 flex items-center justify-between cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors"
                onClick={() => toggleGroupExpanded(groupId)}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="p-1 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); toggleGroupSelection(gObj.chunks); }}
                  >
                    {allSelectedInGroup ? (
                      <CheckSquare size={20} className="text-vibrant-indigo" />
                    ) : (
                      <Square size={20} className="text-slate-300" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{groupName}</h3>
                    <p className="text-[10px] text-slate-500">{gObj.chunks.length} chunks</p>
                  </div>
                </div>
                <div className="text-slate-400">
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
              </div>
              
              {/* Group Content (Chunks) */}
              {isExpanded && (
                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gObj.chunks.map(chunk => {
                    const isSelected = selectedChunkIds.has(chunk.id!);
                    const rating = Math.round(chunk.averageRating || chunk.stars || 0);
                    return (
                      <div
                        key={chunk.id}
                        className={`rounded-2xl border ${isSelected ? "border-vibrant-indigo shadow-md bg-vibrant-indigo/5" : "border-slate-100 shadow-sm bg-white"} p-5 flex flex-col justify-between transition-all cursor-pointer`}
                        onClick={() => toggleChunkSelection(chunk.id!)}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {isSelected ? (
                                <CheckSquare size={16} className="text-vibrant-indigo" />
                              ) : (
                                <Square size={16} className="text-slate-200" />
                              )}
                              <span className="bg-vibrant-indigo/10 text-vibrant-indigo font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                                {chunk.language}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={10}
                                  className={i < rating ? "text-vibrant-yellow" : "text-slate-100"}
                                  fill={i < rating ? "currentColor" : "none"}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-display font-black text-slate-900 text-[15px] leading-tight">
                              {chunk.text}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium italic">
                              {chunk.meaning}
                            </p>
                          </div>
                          {(chunk.ipa || chunk.romanization) && (
                            <div className="space-y-0.5 bg-white/50 p-2 rounded-xl border border-slate-100 text-[9px] font-mono">
                              {chunk.ipa && <div className="text-slate-500">IPA: <span className="text-vibrant-indigo font-bold">{chunk.ipa}</span></div>}
                              {chunk.romanization && <div className="text-vibrant-coral font-bold">Roman: <span className="font-medium">{chunk.romanization}</span></div>}
                            </div>
                          )}
                        </div>
                        <div className="pt-3 mt-3 border-t border-slate-100/50 flex items-center justify-between">
                          <div className="text-[9px] text-slate-400 font-mono font-medium">
                            {(chunk.totalReviews || chunk.timesPracticed || 0) > 0 ? (
                              <div>{chunk.totalReviews || chunk.timesPracticed} reviews</div>
                            ) : (
                              <div className="italic text-slate-300">Chưa luyện tập</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteChunk(chunk.id!); }} 
                              className="p-1.5 text-slate-300 hover:text-vibrant-coral bg-transparent border-none cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); speakText(chunk.text, chunk.language); }} 
                              className="p-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 border-none cursor-pointer"
                            >
                              🔊
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="bg-white border border-slate-100 p-10 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
            <AlertCircle size={32} className="text-slate-200" />
            <p className="text-sm font-black text-slate-700">Không tìm thấy dữ liệu.</p>
          </div>
        )}
      </div>
    </div>
  );
}
