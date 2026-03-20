"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AccountSelector } from "@/components/accounts/account-selector";
import { readManualCache, writeManualCache } from "@/lib/manual-cache";

interface CreateOptionsResponse {
  success: boolean;
  account?: { id: string; name: string; region: string };
  availabilityDomains?: Array<{ name: string }>;
  shapes?: Array<{ shape?: string; processorDescription?: string; ocpus?: number; memoryInGBs?: number }>;
  images?: Array<{ id?: string; displayName?: string; operatingSystem?: string; operatingSystemVersion?: string }>;
  vcns?: Array<{ id?: string; displayName?: string; cidrBlock?: string; ipv6CidrBlocks?: string[] }>;
  subnets?: Array<{ id?: string; displayName?: string; vcnId?: string; cidrBlock?: string; ipv6CidrBlock?: string; prohibitPublicIpOnVnic?: boolean }>;
  message?: string;
}

interface CapacityResponse {
  success: boolean;
  services?: Array<{ name?: string; description?: string }>;
  limitValues?: Array<Record<string, unknown>>;
  message?: string;
}

interface CreateFormState {
  displayName: string;
  availabilityDomain: string;
  shape: string;
  imageId: string;
  subnetId: string;
  assignPublicIp: boolean;
  ipMode: "ipv4" | "dual";
  sshAuthorizedKeys: string;
  ocpus: string;
  memoryInGBs: string;
  loginMode: "generated-ssh" | "manual-ssh" | "password";
  username: string;
  password: string;
  allowRootLogin: boolean;
  enablePasswordAuth: boolean;
}

interface SavedCreatePreferences {
  shape: string;
  imageId: string;
  assignPublicIp: boolean;
  ipMode: "ipv4" | "dual";
  sshAuthorizedKeys: string;
  ocpus: string;
  memoryInGBs: string;
  selectedVcnId: string;
  subnetId: string;
  loginMode: "generated-ssh" | "manual-ssh" | "password";
  username: string;
  allowRootLogin: boolean;
  enablePasswordAuth: boolean;
}

interface TemplatePreset {
  key: string;
  label: string;
  description: string;
  matchShape?: string[];
  matchImage?: string[];
  assignPublicIp?: boolean;
  ipMode?: "ipv4" | "dual";
  preferFlex?: boolean;
}

interface AccountOption {
  id: string;
  name: string;
  region: string;
  isDefault?: boolean;
}

interface ParsedLimitValue {
  name: string;
  scopeType: string;
  availabilityDomain: string;
  value: string;
}

interface CreatePageCachePayload {
  createOptions: CreateOptionsResponse;
  capacity: CapacityResponse | null;
}

const CREATE_PREFS_KEY = "oci-panel:create-preferences:v1";
const CREATE_ACCOUNTS_CACHE_KEY = "oci-panel:create:accounts";
const createPageCacheKey = (accountId: string) => `oci-panel:create:data:${accountId}`;
const initialForm: CreateFormState = {
  displayName: "",
  availabilityDomain: "",
  shape: "",
  imageId: "",
  subnetId: "",
  assignPublicIp: true,
  ipMode: "ipv4",
  sshAuthorizedKeys: "",
  ocpus: "",
  memoryInGBs: "",
  loginMode: "generated-ssh",
  username: "opc",
  password: "",
  allowRootLogin: false,
  enablePasswordAuth: true,
};
function isLinuxImage(image?: { operatingSystem?: string; displayName?: string; operatingSystemVersion?: string } | null) {
  const text = `${image?.operatingSystem || ""} ${image?.displayName || ""} ${image?.operatingSystemVersion || ""}`.toLowerCase();
  return /(ubuntu|debian|oracle linux|centos|rocky|alma|linux)/.test(text);
}

function isWindowsImage(image?: { operatingSystem?: string; displayName?: string } | null) {
  const text = `${image?.operatingSystem || ""} ${image?.displayName || ""}`.toLowerCase();
  return /windows/.test(text);
}

const imageQuickFilters = [
  { label: "全部", value: "" },
  { label: "Ubuntu", value: "ubuntu" },
  { label: "Debian", value: "debian" },
  { label: "Oracle Linux", value: "oracle linux" },
  { label: "CentOS", value: "centos" },
  { label: "Windows", value: "windows" },
];
const shapeQuickFilters = [
  { label: "全部", value: "" },
  { label: "Flex", value: "flex" },
  { label: "ARM", value: "a1" },
  { label: "AMD", value: "e" },
  { label: "VM", value: "vm." },
  { label: "BM", value: "bm." },
];
const templatePresets: TemplatePreset[] = [
  { key: "light-public", label: "轻量公网机", description: "优先常见 VM 规格，公网 IPv4，适合普通站点或测试机。", matchShape: ["vm", "e2", "e3", "e4", "e5"], assignPublicIp: true, ipMode: "ipv4" },
  { key: "arm-low-cost", label: "ARM 低成本机", description: "优先 A1/ARM 规格，适合低成本长期运行。", matchShape: ["a1", "arm"], assignPublicIp: true, ipMode: "ipv4" },
  { key: "flex-custom", label: "Flex 自定义机", description: "优先 Flex 规格，适合手工指定 OCPU 与内存。", matchShape: ["flex"], preferFlex: true, assignPublicIp: true, ipMode: "ipv4" },
  { key: "dual-stack-test", label: "双栈测试机", description: "优先双栈网络模式，适合 IPv6 / 网络验证。", assignPublicIp: true, ipMode: "dual" },
];

function isDisplayNameValid(value: string) {
  return /^[a-zA-Z0-9._-]{1,64}$/.test(value.trim());
}
function isSshKeyFormatValid(value: string) {
  if (!value.trim()) return true;
  return /^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp(256|384|521))\s+.+/.test(value.trim());
}
function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}
function loadSavedPreferences(): SavedCreatePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CREATE_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedCreatePreferences;
  } catch {
    return null;
  }
}
function savePreferences(preferences: SavedCreatePreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREATE_PREFS_KEY, JSON.stringify(preferences));
}
function extractNumericValue(input: string) {
  const match = input.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export default function CreatePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [data, setData] = useState<CreateOptionsResponse | null>(null);
  const [capacityData, setCapacityData] = useState<CapacityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVcnId, setSelectedVcnId] = useState("");
  const [form, setForm] = useState<CreateFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [shapeKeyword, setShapeKeyword] = useState("");
  const [imageKeyword, setImageKeyword] = useState("");
  const [shapeQuickFilter, setShapeQuickFilter] = useState("");
  const [imageQuickFilter, setImageQuickFilter] = useState("");
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState("");
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  function hydrateCreateState(createJson: CreateOptionsResponse, nextCapacityData: CapacityResponse | null) {
    setData(createJson);
    setCapacityData(nextCapacityData);
    setSubmitMessage(null);
    setValidationMessage(null);
    setTemplateMessage(null);
    setShapeKeyword("");
    setImageKeyword("");
    setShapeQuickFilter("");
    setImageQuickFilter("");
    setActiveTemplateKey("");

    const saved = loadSavedPreferences();
    const firstVcn = saved?.selectedVcnId && createJson.vcns?.some((item) => item.id === saved.selectedVcnId) ? saved.selectedVcnId : createJson.vcns?.[0]?.id || "";
    const subnetPool = (createJson.subnets || []).filter((item) => !firstVcn || item.vcnId === firstVcn);
    const firstSubnet = saved?.subnetId && subnetPool.some((item) => item.id === saved.subnetId) ? saved.subnetId : subnetPool[0]?.id || "";
    const firstAd = createJson.availabilityDomains?.[0]?.name || "";
    const firstShape = saved?.shape && createJson.shapes?.some((item) => item.shape === saved.shape) ? saved.shape : createJson.shapes?.[0]?.shape || "";
    const firstImageId = saved?.imageId && createJson.images?.some((item) => item.id === saved.imageId) ? saved.imageId : createJson.images?.[0]?.id || "";

    setSelectedVcnId(firstVcn);
    setForm({
      ...initialForm,
      availabilityDomain: firstAd,
      shape: firstShape,
      imageId: firstImageId,
      subnetId: firstSubnet,
      assignPublicIp: saved?.assignPublicIp ?? true,
      ipMode: saved?.ipMode ?? "ipv4",
      sshAuthorizedKeys: saved?.sshAuthorizedKeys || "",
      ocpus: saved?.ocpus || "",
      memoryInGBs: saved?.memoryInGBs || "",
      loginMode: saved?.loginMode ?? "generated-ssh",
      username: saved?.username || "opc",
      allowRootLogin: saved?.allowRootLogin ?? false,
      enablePasswordAuth: saved?.enablePasswordAuth ?? true,
    });
  }

  async function refreshAccountsList() {
    const res = await fetch("/api/accounts", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "加载账户列表失败");
    const accountsData = json as AccountOption[];
    setAccounts(accountsData);
    writeManualCache(CREATE_ACCOUNTS_CACHE_KEY, accountsData);
    return accountsData;
  }

  async function loadCreateResources(accountId: string, mode: "initial" | "refresh" = "initial") {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setCapacityLoading(true);
      setError(null);

      const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
      const [createRes, capacityRes] = await Promise.all([
        fetch(`/api/create-options${query}`, { cache: "no-store" }),
        fetch(`/api/capacity${query}`, { cache: "no-store" }),
      ]);

      const createJson = (await createRes.json()) as CreateOptionsResponse;
      if (!createRes.ok || !createJson.success) throw new Error(createJson.message || "加载创建资源失败");

      const capacityJson = (await capacityRes.json()) as CapacityResponse;
      const nextCapacityData = capacityRes.ok && capacityJson.success ? capacityJson : null;

      hydrateCreateState(createJson, nextCapacityData);
      const cache = writeManualCache<CreatePageCachePayload>(createPageCacheKey(accountId), {
        createOptions: createJson,
        capacity: nextCapacityData,
      });
      setLastRefreshedAt(cache?.refreshedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setCapacityLoading(false);
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const cachedAccounts = readManualCache<AccountOption[]>(CREATE_ACCOUNTS_CACHE_KEY);
    const initialAccounts = cachedAccounts?.data || [];
    if (initialAccounts.length > 0) {
      setAccounts(initialAccounts);
      const defaultAccount = initialAccounts.find((item) => item.isDefault);
      const fallback = defaultAccount?.id || initialAccounts[0]?.id || "";
      if (fallback) setSelectedAccountId(fallback);
      else setLoading(false);
      return;
    }

    async function init() {
      try {
        const accountsData = await refreshAccountsList();
        const defaultAccount = accountsData.find((item) => item.isDefault);
        const fallback = defaultAccount?.id || accountsData[0]?.id || "";
        if (fallback) setSelectedAccountId(fallback);
        else setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
        setLoading(false);
      }
    }

    void init();
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    const cached = readManualCache<CreatePageCachePayload>(createPageCacheKey(selectedAccountId));
    if (cached) {
      hydrateCreateState(cached.data.createOptions, cached.data.capacity);
      setLastRefreshedAt(cached.refreshedAt);
      setLoading(false);
      setCapacityLoading(false);
      setError(null);
      return;
    }
    void loadCreateResources(selectedAccountId, "initial");
  }, [selectedAccountId]);

  useEffect(() => {
    if (!data) return;
    savePreferences({ shape: form.shape, imageId: form.imageId, assignPublicIp: form.assignPublicIp, ipMode: form.ipMode, sshAuthorizedKeys: form.sshAuthorizedKeys, ocpus: form.ocpus, memoryInGBs: form.memoryInGBs, selectedVcnId, subnetId: form.subnetId, loginMode: form.loginMode, username: form.username, allowRootLogin: form.allowRootLogin, enablePasswordAuth: form.enablePasswordAuth });
  }, [data, form.shape, form.imageId, form.assignPublicIp, form.ipMode, form.sshAuthorizedKeys, form.ocpus, form.memoryInGBs, selectedVcnId, form.subnetId, form.loginMode, form.username, form.allowRootLogin, form.enablePasswordAuth]);

  const parsedLimitValues = useMemo<ParsedLimitValue[]>(() => {
    return (capacityData?.limitValues || []).map((item) => ({
      name: normalizeText(item.name || item.displayName || item.limitName),
      scopeType: normalizeText(item.scopeType || item.scope || "-") || "-",
      availabilityDomain: normalizeText(item.availabilityDomain || item.ad || "区域级") || "区域级",
      value: normalizeText(item.value || item.limit || item.available || "-") || "-",
    }));
  }, [capacityData?.limitValues]);

  const filteredShapes = useMemo(() => {
    const keyword = shapeKeyword.trim().toLowerCase();
    const quick = shapeQuickFilter.trim().toLowerCase();
    return (data?.shapes || []).filter((item) => {
      const text = [item.shape, item.processorDescription, item.ocpus, item.memoryInGBs].join(" ").toLowerCase();
      if (keyword && !text.includes(keyword)) return false;
      if (quick && !text.includes(quick)) return false;
      return true;
    });
  }, [data?.shapes, shapeKeyword, shapeQuickFilter]);

  const filteredImages = useMemo(() => {
    const keyword = imageKeyword.trim().toLowerCase();
    const quick = imageQuickFilter.trim().toLowerCase();
    return (data?.images || []).filter((item) => {
      const text = [item.displayName, item.operatingSystem, item.operatingSystemVersion].join(" ").toLowerCase();
      if (keyword && !text.includes(keyword)) return false;
      if (quick && !text.includes(quick)) return false;
      return true;
    });
  }, [data?.images, imageKeyword, imageQuickFilter]);

  const filteredSubnets = useMemo(() => (data?.subnets || []).filter((item) => !selectedVcnId || item.vcnId === selectedVcnId), [data?.subnets, selectedVcnId]);

  useEffect(() => {
    if (!filteredImages.length) return;
    const stillExists = filteredImages.some((item) => item.id === form.imageId);
    if (!stillExists) {
      setForm((prev) => ({ ...prev, imageId: filteredImages[0]?.id || "" }));
    }
  }, [filteredImages, form.imageId]);

  const selectedShape = useMemo(() => (data?.shapes || []).find((item) => item.shape === form.shape), [data?.shapes, form.shape]);
  const selectedImage = useMemo(() => (data?.images || []).find((item) => item.id === form.imageId), [data?.images, form.imageId]);
  const isLinuxSelected = useMemo(() => isLinuxImage(selectedImage), [selectedImage]);
  const isWindowsSelected = useMemo(() => isWindowsImage(selectedImage), [selectedImage]);
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState("");
  const [generatedKeyLoading, setGeneratedKeyLoading] = useState(false);
  const selectedVcn = useMemo(() => (data?.vcns || []).find((item) => item.id === selectedVcnId), [data?.vcns, selectedVcnId]);
  const selectedSubnet = useMemo(() => (data?.subnets || []).find((item) => item.id === form.subnetId), [data?.subnets, form.subnetId]);

  const isFlexShape = Boolean(form.shape && /flex/i.test(form.shape));
  const subnetSupportsIpv6 = Boolean(selectedSubnet?.ipv6CidrBlock || (selectedVcn?.ipv6CidrBlocks && selectedVcn.ipv6CidrBlocks.length > 0));
  const computeService = useMemo(() => (capacityData?.services || []).find((item) => item.name?.toLowerCase().includes("compute")), [capacityData?.services]);
  const computeRelevantLimitValues = useMemo(() => {
    const adKeyword = form.availabilityDomain.toLowerCase();
    return parsedLimitValues.filter((item) => {
      const text = `${item.name} ${item.scopeType} ${item.availabilityDomain}`.toLowerCase();
      const matched = /(core|ocpu|vm|instance|compute|memory|a1|e2|e3|e4|e5|flex)/.test(text);
      const adMatched = item.availabilityDomain === "区域级" || item.availabilityDomain.toLowerCase().includes(adKeyword);
      return matched && adMatched;
    }).slice(0, 8);
  }, [parsedLimitValues, form.availabilityDomain]);

  const capacityHint = useMemo(() => {
    const count = capacityData?.limitValues?.length || 0;
    if (!capacityData) return "未加载额度信息";
    if (count === 0) return "已查询额度，但当前未拿到可展示的 compute limit values";
    return `已查询到 ${count} 条 limit values，可作为创建前容量参考`;
  }, [capacityData]);

  const desiredOcpus = useMemo(() => {
    if (isFlexShape && form.ocpus) return Number(form.ocpus);
    return selectedShape?.ocpus ?? null;
  }, [isFlexShape, form.ocpus, selectedShape?.ocpus]);

  const desiredMemory = useMemo(() => {
    if (isFlexShape && form.memoryInGBs) return Number(form.memoryInGBs);
    return selectedShape?.memoryInGBs ?? null;
  }, [isFlexShape, form.memoryInGBs, selectedShape?.memoryInGBs]);

  const feasibility = useMemo(() => {
    if (!capacityData) {
      return { tone: "slate", title: "容量信息未加载", detail: "当前无法结合额度判断创建可行性，请先确认 capacity 页面可正常返回数据。" };
    }
    if (!computeService) {
      return { tone: "amber", title: "未识别 Compute 服务", detail: "当前额度返回中未识别到明确的 compute 服务名，只能给出基础网络和参数校验提示。" };
    }
    if (computeRelevantLimitValues.length === 0) {
      return { tone: "amber", title: "缺少匹配额度项", detail: `当前没有筛出与 ${form.availabilityDomain || "所选 AD"} 更相关的 compute 额度条目，建议先去 capacity 页核对区域容量。` };
    }

    const ocpuRelated = computeRelevantLimitValues.find((item) => /(ocpu|core)/i.test(item.name));
    const memoryRelated = computeRelevantLimitValues.find((item) => /memory/i.test(item.name));
    const ocpuLimit = ocpuRelated ? extractNumericValue(ocpuRelated.value) : null;
    const memoryLimit = memoryRelated ? extractNumericValue(memoryRelated.value) : null;

    if (desiredOcpus && ocpuLimit != null && desiredOcpus > ocpuLimit) {
      return { tone: "rose", title: "OCPU 需求高于参考额度", detail: `当前需求约 ${desiredOcpus} OCPU，但参考额度条目 ${ocpuRelated?.name || "OCPU"} 的值约为 ${ocpuRelated?.value || ocpuLimit}。` };
    }
    if (desiredMemory && memoryLimit != null && desiredMemory > memoryLimit) {
      return { tone: "rose", title: "内存需求高于参考额度", detail: `当前需求约 ${desiredMemory} GB，但参考额度条目 ${memoryRelated?.name || "Memory"} 的值约为 ${memoryRelated?.value || memoryLimit}。` };
    }

    return { tone: "emerald", title: "创建前容量检查通过", detail: `已识别 ${computeService.name}，并筛出 ${computeRelevantLimitValues.length} 条相关额度参考。当前参数未发现明显超出参考额度的情况。` };
  }, [capacityData, computeService, computeRelevantLimitValues, form.availabilityDomain, desiredOcpus, desiredMemory]);

  const runtimeWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (form.ipMode === "dual" && !subnetSupportsIpv6) warnings.push("当前 VCN/Subnet 未发现 IPv6 配置，双栈创建可能失败或无法分配 IPv6。");
    if (form.assignPublicIp && selectedSubnet?.prohibitPublicIpOnVnic) warnings.push("当前 Subnet 标记为默认禁止公网 IP，即使勾选分配公网 IPv4，也可能被网络策略阻止。");
    if (isFlexShape && (!form.ocpus || !form.memoryInGBs)) warnings.push("当前为 Flex Shape，建议明确填写 OCPU 与内存，避免提交前校验失败。");
    if (capacityData && !computeService) warnings.push("额度页未识别到 compute 服务，当前无法给出更细的创建容量提示。");
    if (capacityData && computeRelevantLimitValues.length === 0) warnings.push("当前未筛出与所选 AD / Compute 相关的额度条目，创建前请谨慎确认目标区域容量。");
    if (feasibility.tone === "rose") warnings.push(feasibility.detail);
    return warnings;
  }, [form.ipMode, subnetSupportsIpv6, form.assignPublicIp, selectedSubnet?.prohibitPublicIpOnVnic, isFlexShape, form.ocpus, form.memoryInGBs, capacityData, computeService, computeRelevantLimitValues.length, feasibility]);

  async function handleGenerateSshKey() {
    try {
      setGeneratedKeyLoading(true);
      const res = await fetch("/api/ssh-keypair", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "生成 SSH Key 失败");
      setForm((prev) => ({ ...prev, sshAuthorizedKeys: json.publicKey, loginMode: "generated-ssh" }));
      setGeneratedPrivateKey(json.privateKey || "");
      setTemplateMessage("已自动生成新的 SSH Key，请立即下载并妥善保存私钥。");
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "生成 SSH Key 失败");
    } finally {
      setGeneratedKeyLoading(false);
    }
  }

  function downloadPrivateKey() {
    if (!generatedPrivateKey || typeof window === "undefined") return;
    const blob = new Blob([generatedPrivateKey], { type: "application/x-pem-file" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.displayName || "oci-instance"}-id_ed25519.pem`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyTemplate(template: TemplatePreset) {
    if (!data) return;
    const nextShape = (data.shapes || []).find((item) => {
      const text = `${item.shape || ""} ${item.processorDescription || ""}`.toLowerCase();
      return template.matchShape?.some((keyword) => text.includes(keyword.toLowerCase()));
    })?.shape || form.shape;
    const nextImage = (data.images || []).find((item) => {
      const text = `${item.displayName || ""} ${item.operatingSystem || ""} ${item.operatingSystemVersion || ""}`.toLowerCase();
      return template.matchImage?.some((keyword) => text.includes(keyword.toLowerCase()));
    })?.id || form.imageId;
    const candidateSubnets = filteredSubnets.length > 0 ? filteredSubnets : (data.subnets || []);
    const ipv6CapableSubnet = candidateSubnets.find((item) => item.ipv6CidrBlock);
    const publicCapableSubnet = candidateSubnets.find((item) => !item.prohibitPublicIpOnVnic);
    const nextSubnetId = template.ipMode === "dual" ? (ipv6CapableSubnet?.id || form.subnetId) : template.assignPublicIp === true ? (publicCapableSubnet?.id || form.subnetId) : form.subnetId;
    setActiveTemplateKey(template.key);
    setForm((prev) => ({ ...prev, shape: nextShape, imageId: nextImage, subnetId: nextSubnetId, assignPublicIp: template.assignPublicIp ?? prev.assignPublicIp, ipMode: template.ipMode ?? prev.ipMode, ocpus: template.preferFlex ? (prev.ocpus || "1") : prev.ocpus, memoryInGBs: template.preferFlex ? (prev.memoryInGBs || "6") : prev.memoryInGBs }));
    setTemplateMessage(`已应用模板：${template.label}`);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage(null);
    setValidationMessage(null);
    try {
      if (!form.displayName.trim()) throw new Error("请填写实例名");
      if (!isDisplayNameValid(form.displayName)) throw new Error("实例名只允许 1-64 位字母、数字、点、下划线、短横线");
      if (!form.availabilityDomain || !form.shape || !form.imageId || !form.subnetId) throw new Error("请完整选择 AD、Shape、镜像和 Subnet");
      if ((form.loginMode === "manual-ssh" || form.loginMode === "generated-ssh") && !isSshKeyFormatValid(form.sshAuthorizedKeys)) throw new Error("SSH 公钥格式不正确，请粘贴标准 ssh-rsa / ssh-ed25519 / ecdsa 公钥");
      if (form.loginMode === "password") {
        if (!form.username.trim()) throw new Error("请填写登录用户名");
        if (form.password.length < 8) throw new Error("密码至少需要 8 位");
      }
      if (form.ipMode === "dual" && !subnetSupportsIpv6) throw new Error("当前所选网络未发现 IPv6 配置，不能直接使用双栈模式");
      if (form.assignPublicIp && selectedSubnet?.prohibitPublicIpOnVnic) throw new Error("当前 Subnet 默认禁止公网 IP，请取消公网 IP 或更换 Subnet");
      if (isFlexShape) {
        if (!form.ocpus || Number(form.ocpus) <= 0) throw new Error("Flex 规格必须填写有效的 OCPU");
        if (!form.memoryInGBs || Number(form.memoryInGBs) <= 0) throw new Error("Flex 规格必须填写有效的内存大小（GB）");
      }
      const payload = { accountId: data?.account?.id, availabilityDomain: form.availabilityDomain, subnetId: form.subnetId, imageId: form.imageId, shape: form.shape, displayName: form.displayName, assignPublicIp: form.assignPublicIp, ipMode: form.ipMode, sshAuthorizedKeys: form.loginMode === "password" ? undefined : form.sshAuthorizedKeys, ocpus: isFlexShape && form.ocpus ? Number(form.ocpus) : undefined, memoryInGBs: isFlexShape && form.memoryInGBs ? Number(form.memoryInGBs) : undefined, loginMode: form.loginMode, username: form.loginMode === "password" ? form.username : undefined, password: form.loginMode === "password" ? form.password : undefined, allowRootLogin: form.loginMode === "password" ? form.allowRootLogin : undefined, enablePasswordAuth: form.loginMode === "password" ? form.enablePasswordAuth : undefined };
      const res = await fetch("/api/instances/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = (await res.json()) as { success?: boolean; message?: string; instance?: { id?: string; name?: string } };
      if (!res.ok || !json.success) throw new Error(json.message || "创建实例失败");
      setSubmitMessage(`创建已提交：${json.instance?.name || form.displayName}${json.instance?.id ? `（${json.instance.id}）` : ""}`);
      setForm((prev) => ({ ...prev, displayName: "", ocpus: prev.ocpus, memoryInGBs: prev.memoryInGBs }));
      setTimeout(() => {
        if (json.instance?.id) router.push(`/instances/${encodeURIComponent(json.instance.id)}?accountId=${encodeURIComponent(selectedAccountId)}&track=create`);
        else router.push(`/instances?accountId=${encodeURIComponent(selectedAccountId)}`);
      }, 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建失败";
      setSubmitMessage(message);
      setValidationMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">正在加载创建实例所需资源...</section> : error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center text-rose-700 shadow-sm">{error}</section> : accounts.length === 0 ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">还没有可用账户，先去账户页添加 OCI 账户后再创建实例。</section> : (
        <section className="space-y-8">
          <AccountSelector accounts={accounts} value={selectedAccountId} onChange={setSelectedAccountId} onRefresh={() => selectedAccountId && void loadCreateResources(selectedAccountId, "refresh")} refreshing={refreshing} refreshLabel="刷新创建资源" lastRefreshedAt={lastRefreshedAt} hint="创建页优先显示上次缓存的 AD、镜像、Shape、VCN、Subnet 与容量参考；只有点击刷新才重新拉取最新资源。" />
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">P2A / P2D 联动</p><h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">创建实例</h3><p className="mt-2 text-sm text-slate-500">当前账户：{data?.account?.name} · 区域：{data?.account?.region}</p></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">模板预设</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{templatePresets.map((template) => <button key={template.key} type="button" onClick={() => applyTemplate(template)} className={`rounded-2xl border p-4 text-left ${activeTemplateKey === template.key ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}><p className="text-sm font-semibold text-slate-900">{template.label}</p><p className="mt-2 text-xs text-slate-500">{template.description}</p></button>)}</div>{templateMessage ? <p className="mt-4 text-sm text-slate-600">{templateMessage}</p> : null}</section>
          <form className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]" onSubmit={handleSubmit}>
            <section className="space-y-8">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">基础配置</p><div className="mt-4 grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">实例名</label><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="例如 oci-singapore-web-01" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />{form.displayName && !isDisplayNameValid(form.displayName) ? <p className="mt-2 text-xs text-rose-600">实例名只允许字母、数字、点、下划线、短横线，最长 64 位</p> : null}</div><div><label className="mb-2 block text-sm font-medium text-slate-700">Availability Domain</label><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.availabilityDomain} onChange={(e) => setForm({ ...form, availabilityDomain: e.target.value })}>{(data?.availabilityDomains || []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></div><div><label className="mb-2 block text-sm font-medium text-slate-700">搜索 Shape</label><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="按 shape / 架构 / OCPU / 内存过滤" value={shapeKeyword} onChange={(e) => setShapeKeyword(e.target.value)} /></div><div className="md:col-span-2 flex flex-wrap gap-2">{shapeQuickFilters.map((item) => <button key={item.label} type="button" onClick={() => setShapeQuickFilter(item.value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${shapeQuickFilter === item.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{item.label}</button>)}</div><div className="md:col-span-2"><label className="mb-2 block text-sm font-medium text-slate-700">规格 Shape</label><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value })}>{filteredShapes.map((shape) => <option key={shape.shape} value={shape.shape}>{shape.shape} · {shape.ocpus || "-"} OCPU · {shape.memoryInGBs || "-"} GB</option>)}</select><p className="mt-2 text-xs text-slate-500">共 {filteredShapes.length} 个可选 Shape{shapeKeyword ? `（已按“${shapeKeyword}”过滤）` : ""}{shapeQuickFilter ? `（快捷筛选：${shapeQuickFilter}）` : ""}</p></div></div>{selectedShape ? <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">当前 Shape：{selectedShape.shape}</p><p className="mt-1">{selectedShape.processorDescription || "暂无处理器说明"}</p><p className="mt-2">默认规格：{selectedShape.ocpus || "-"} OCPU · {selectedShape.memoryInGBs || "-"} GB</p>{isFlexShape ? <p className="mt-2 text-amber-700">这是 Flex 规格，必须显式填写 OCPU 和内存后再提交创建。</p> : null}</div> : null}{isFlexShape ? <div className="mt-4 grid gap-4 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-slate-700">OCPU</label><input type="number" min="1" step="1" className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm" placeholder={selectedShape?.ocpus ? String(selectedShape.ocpus) : "例如 1"} value={form.ocpus} onChange={(e) => setForm({ ...form, ocpus: e.target.value })} /></div><div><label className="mb-2 block text-sm font-medium text-slate-700">内存 GB</label><input type="number" min="1" step="1" className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm" placeholder={selectedShape?.memoryInGBs ? String(selectedShape.memoryInGBs) : "例如 6"} value={form.memoryInGBs} onChange={(e) => setForm({ ...form, memoryInGBs: e.target.value })} /></div></div> : null}</section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">镜像与网络</p><div className="mt-4 grid gap-4"><div><label className="mb-2 block text-sm font-medium text-slate-700">搜索镜像</label><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="按镜像名 / 系统 / 版本过滤" value={imageKeyword} onChange={(e) => setImageKeyword(e.target.value)} /></div><div className="flex flex-wrap gap-2">{imageQuickFilters.map((item) => <button key={item.label} type="button" onClick={() => setImageQuickFilter(item.value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${imageQuickFilter === item.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{item.label}</button>)}</div><div><label className="mb-2 block text-sm font-medium text-slate-700">镜像</label><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.imageId} onChange={(e) => setForm({ ...form, imageId: e.target.value })}>{filteredImages.map((image) => <option key={image.id} value={image.id}>{image.displayName} {image.operatingSystem ? `· ${image.operatingSystem} ${image.operatingSystemVersion || ""}` : ""}</option>)}</select><p className="mt-2 text-xs text-slate-500">共 {filteredImages.length} 个可选镜像{imageKeyword ? `（已按“${imageKeyword}”过滤）` : ""}{imageQuickFilter ? `（快捷筛选：${imageQuickFilter}）` : ""}</p></div>{selectedImage ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">当前镜像：{selectedImage.displayName}</p><p className="mt-1">系统：{selectedImage.operatingSystem || "-"} {selectedImage.operatingSystemVersion || ""}</p></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">当前筛选条件下没有可选镜像，请调整关键字或快捷筛选。</div>}<div className="grid gap-4 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-slate-700">VCN</label><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={selectedVcnId} onChange={(e) => { const nextVcnId = e.target.value; const nextSubnetId = (data?.subnets || []).find((item) => item.vcnId === nextVcnId)?.id || ""; setSelectedVcnId(nextVcnId); setForm((prev) => ({ ...prev, subnetId: nextSubnetId })); }}>{(data?.vcns || []).map((vcn) => <option key={vcn.id} value={vcn.id}>{vcn.displayName}</option>)}</select></div><div><label className="mb-2 block text-sm font-medium text-slate-700">Subnet</label><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.subnetId} onChange={(e) => setForm({ ...form, subnetId: e.target.value })}>{filteredSubnets.map((subnet) => <option key={subnet.id} value={subnet.id}>{subnet.displayName}</option>)}</select></div></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">当前 VCN</p><p className="mt-2">名称：{selectedVcn?.displayName || "-"}</p><p className="mt-1">CIDR：{selectedVcn?.cidrBlock || "-"}</p><p className="mt-1">IPv6：{selectedVcn?.ipv6CidrBlocks?.length ? selectedVcn.ipv6CidrBlocks.join(", ") : "未配置"}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-900">当前 Subnet</p><p className="mt-2">名称：{selectedSubnet?.displayName || "-"}</p><p className="mt-1">CIDR：{selectedSubnet?.cidrBlock || "-"}</p><p className="mt-1">IPv6：{selectedSubnet?.ipv6CidrBlock || "未配置"}</p><p className="mt-1">公网 IP 默认：{selectedSubnet?.prohibitPublicIpOnVnic ? "子网默认禁止" : "子网允许"}</p></div></div><div className="grid gap-4 md:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.assignPublicIp} onChange={(e) => setForm({ ...form, assignPublicIp: e.target.checked })} />分配公网 IPv4</label><div><label className="mb-2 block text-sm font-medium text-slate-700">网络模式</label><select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.ipMode} onChange={(e) => setForm({ ...form, ipMode: e.target.value as "ipv4" | "dual" })}><option value="ipv4">仅 IPv4</option><option value="dual">双栈 IPv4 + IPv6</option></select></div></div>{form.ipMode === "dual" && !subnetSupportsIpv6 ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">当前所选网络未发现 IPv6 配置，双栈模式不可用。请切换到支持 IPv6 的 VCN/Subnet，或改回仅 IPv4。</div> : null}{form.assignPublicIp && selectedSubnet?.prohibitPublicIpOnVnic ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">当前 Subnet 默认禁止公网 IP。若继续使用该 Subnet，请关闭公网 IPv4，或切换到允许公网 IP 的子网。</div> : null}</div></section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">登录方式</p><div className="mt-4 space-y-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setForm((prev) => ({ ...prev, loginMode: "generated-ssh" }))} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.loginMode === "generated-ssh" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>自动生成 SSH Key</button><button type="button" onClick={() => setForm((prev) => ({ ...prev, loginMode: "manual-ssh" }))} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.loginMode === "manual-ssh" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>手动提供 SSH 公钥</button><button type="button" onClick={() => setForm((prev) => ({ ...prev, loginMode: "password" }))} disabled={!isLinuxSelected} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${form.loginMode === "password" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"} disabled:opacity-50`}>密码初始化（高级）</button></div>{isWindowsSelected ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">当前镜像看起来是 Windows，Linux 风格的 root/用户密码初始化能力不一定适用，建议优先使用 Windows 自身密码流程。</div> : null}{form.loginMode === "generated-ssh" ? <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void handleGenerateSshKey()} disabled={generatedKeyLoading} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{generatedKeyLoading ? "生成中..." : "自动生成 SSH Key"}</button>{generatedPrivateKey ? <button type="button" onClick={downloadPrivateKey} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">下载私钥</button> : null}</div><textarea className="min-h-32 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="点击上方按钮后会自动填入公钥" value={form.sshAuthorizedKeys} onChange={(e) => setForm({ ...form, sshAuthorizedKeys: e.target.value })} />{generatedPrivateKey ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">私钥只会在当前页面显示一次，请立即下载并妥善保存。平台不会帮你长期托管这把登录私钥。</div> : null}</div> : null}{form.loginMode === "manual-ssh" ? <div><textarea className="min-h-40 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="粘贴公钥，例如 ssh-ed25519 ..." value={form.sshAuthorizedKeys} onChange={(e) => setForm({ ...form, sshAuthorizedKeys: e.target.value })} />{form.sshAuthorizedKeys && !isSshKeyFormatValid(form.sshAuthorizedKeys) ? <p className="mt-2 text-xs text-rose-600">SSH 公钥格式看起来不正确</p> : null}</div> : null}{form.loginMode === "password" ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-2 block text-sm font-medium text-slate-700">登录用户名</label><input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="例如 opc / ubuntu / 自定义用户" /></div><div><label className="mb-2 block text-sm font-medium text-slate-700">初始密码</label><input type="password" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少 8 位" /></div></div><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.enablePasswordAuth} onChange={(e) => setForm({ ...form, enablePasswordAuth: e.target.checked })} /> 启用 SSH 密码登录</label><label className="flex items-center gap-2 text-sm text-rose-700"><input type="checkbox" checked={form.allowRootLogin} onChange={(e) => setForm({ ...form, allowRootLogin: e.target.checked })} /> 允许 root 登录（高风险高级选项）</label><div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">该模式通过 cloud-init 初始化用户密码，并可选开启 root 登录。默认更推荐使用 SSH Key。</div></div> : null}</div></section>
            </section>
            <section className="space-y-8">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">创建前检查</p><div className="mt-4 space-y-3 text-sm text-slate-600"><div className={`rounded-xl border px-4 py-3 ${feasibility.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : feasibility.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><p className="font-semibold">{feasibility.title}</p><p className="mt-2">{feasibility.detail}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="font-semibold text-slate-900">容量检查</p><p className="mt-1">{capacityLoading ? "正在查询额度信息..." : capacityHint}</p><p className="mt-1 text-xs text-slate-500">{computeService?.name ? `已识别服务：${computeService.name}` : "尚未识别到明确的 compute 服务名"}</p><p className="mt-2 text-xs text-slate-500">当前需求：{desiredOcpus ?? "-"} OCPU · {desiredMemory ?? "-"} GB · {form.availabilityDomain || "未选 AD"}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="font-semibold text-slate-900">Compute 相关额度参考</p>{computeRelevantLimitValues.length > 0 ? <div className="mt-3 space-y-2">{computeRelevantLimitValues.map((item) => <div key={`${item.name}-${item.scopeType}-${item.availabilityDomain}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-sm font-medium text-slate-900">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.scopeType} · {item.availabilityDomain}</p><p className="mt-1 text-sm text-slate-700">值：{item.value}</p></div>)}</div> : <p className="mt-2 text-sm text-slate-500">当前没有筛出与所选 AD 更相关的 compute 额度条目。</p>}</div>{runtimeWarnings.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><p className="font-semibold">当前风险提示</p><ul className="mt-2 list-disc space-y-1 pl-5">{runtimeWarnings.map((item) => <li key={item}>{item}</li>)}</ul></div> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">当前未发现明显的网络约束冲突，可以继续提交创建。</div>}</div></section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">提交前确认</p><div className="mt-4 space-y-3 text-sm text-slate-600"><div className="flex justify-between gap-4"><span>账户</span><span className="text-right text-slate-900">{data?.account?.name || "-"}</span></div><div className="flex justify-between gap-4"><span>实例名</span><span className="text-right text-slate-900">{form.displayName || "-"}</span></div><div className="flex justify-between gap-4"><span>AD</span><span className="text-right text-slate-900">{form.availabilityDomain || "-"}</span></div><div className="flex justify-between gap-4"><span>Shape</span><span className="text-right text-slate-900">{form.shape || "-"}</span></div><div className="flex justify-between gap-4"><span>镜像</span><span className="text-right text-slate-900">{selectedImage?.displayName || "-"}</span></div><div className="flex justify-between gap-4"><span>VCN / Subnet</span><span className="text-right text-slate-900">{selectedVcn?.displayName || "-"} / {selectedSubnet?.displayName || "-"}</span></div><div className="flex justify-between gap-4"><span>网络模式</span><span className="text-right text-slate-900">{form.ipMode === "dual" ? "双栈" : "仅 IPv4"}</span></div><div className="flex justify-between gap-4"><span>公网 IP</span><span className="text-right text-slate-900">{form.assignPublicIp ? "开启" : "关闭"}</span></div></div><div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">P2D-2 已把 capacity 与 create 进一步联动：会按当前 AD / Shape / Flex 需求给出更明确的创建可行性提示。</div>{validationMessage ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{validationMessage}</div> : null}<div className="mt-6 flex flex-col gap-3"><button className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50" disabled={submitting}>{submitting ? "提交中..." : "创建实例"}</button>{submitMessage ? <p className="text-sm text-slate-600">{submitMessage}</p> : null}</div></section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Shape 预览</p><div className="mt-4 grid gap-3">{filteredShapes.slice(0, 8).map((shape) => <div key={shape.shape} className={`rounded-xl border px-4 py-4 ${shape.shape === form.shape ? "border-slate-900 bg-slate-50" : "border-slate-100 bg-slate-50"}`}><p className="text-sm font-semibold text-slate-900">{shape.shape}</p><p className="mt-1 text-xs text-slate-500">{shape.processorDescription || "-"}</p><p className="mt-2 text-sm text-slate-600">{shape.ocpus || "-"} OCPU · {shape.memoryInGBs || "-"} GB</p></div>)}</div></section>
            </section>
          </form>
        </section>
      )}
    </AppShell>
  );
}
