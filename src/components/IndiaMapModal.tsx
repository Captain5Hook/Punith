/// <reference types="google.maps" />
import {
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMap,
  InfoWindow,
  Pin,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  ArrowLeft,
  Compass,
  Crosshair,
  Droplet,
  Loader2,
  Map as MapIcon,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INDIA_STATES_SVG,
  INDIA_SVG_VIEWBOX,
  projectIndiaLatLng,
  type IndiaStateShape,
} from '../data/indiaStatesSvg';
import type { BloodCenter } from '../types/blood';
import { distanceKm } from '../utils/bloodCompatibility';

const INDIA_CENTER = { lat: 22.5937, lng: 78.9629 };
const INDIA_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 35.5,
  south: 6.75,
  east: 97.4,
  west: 68.1,
};

// Harmonious shades of red/crimson/garnet matching the PulseDrop home screen
const RED_SHADES = [
  '#9F1239', // crimson rose
  '#BE123C', // vivid blood red
  '#881337', // rosewood crimson
  '#D61F4B', // bright carmine red
  '#7F1D3A', // deep ruby
  '#B0163E', // garnet red
];

const SHORT_STATE_LABELS: Record<string, string> = {
  'Jammu and Kashmir': 'J & K',
  'Himachal Pradesh': 'H.P.',
  'Uttarakhand': 'Uttarakhand',
  'Arunachal Pradesh': 'Arunachal',
  'Madhya Pradesh': 'Madhya Pradesh',
  'Andhra Pradesh': 'Andhra Pradesh',
  'Uttar Pradesh': 'Uttar Pradesh',
  'Delhi': 'DL',
  'Goa': 'Goa',
  'Sikkim': 'SK',
  'Tripura': 'TR',
  'Mizoram': 'MZ',
  'Manipur': 'MN',
  'Nagaland': 'NL',
  'Meghalaya': 'ML',
  'Chandigarh': '',
  'Puducherry': '',
  'Daman and Diu': '',
  'Dadra and Nagar Haveli': '',
};

const LABEL_OFFSETS: Record<string, { dx?: number; dy?: number }> = {
  'Maharashtra': { dx: -8, dy: 2 },
  'Karnataka': { dx: -2, dy: 6 },
  'Andhra Pradesh': { dx: -8, dy: 8 },
  'Telangana': { dx: 0, dy: 2 },
  'Tamil Nadu': { dx: 3, dy: 4 },
  'Kerala': { dx: -6, dy: 0 },
  'West Bengal': { dx: 2, dy: 8 },
  'Jharkhand': { dx: -2, dy: 2 },
  'Chhattisgarh': { dx: -2, dy: 0 },
  'Gujarat': { dx: -4, dy: -2 },
  'Assam': { dx: 4, dy: -2 },
};

interface IndiaMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasApiKey: boolean;
  userCoords: { lat: number; lng: number } | null;
  gpsCoords: { lat: number; lng: number } | null;
  currentCity: string;
  currentState: string | null;
  centers: BloodCenter[];
  onLocationUpdated: (payload: {
    lat: number | null;
    lng: number | null;
    city: string;
    state: string | null;
    isGps?: boolean;
  }) => void;
  onCentersUpdated: (centers: BloodCenter[]) => void;
  onOpenLogDonation: (center: BloodCenter) => void;
}

function isQuotaError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? '');
  return (
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('QuotaExceeded') ||
    text.includes('429')
  );
}

function normalizeStateKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bnct of\b/g, '')
    .replace(/\bislands\b/g, '')
    .replace(/[^a-z]/g, '');
}

function stateMatches(shape: IndiaStateShape, targetState: string | null): boolean {
  if (!targetState) return false;
  const t = normalizeStateKey(targetState);
  const s1 = normalizeStateKey(shape.name);
  const s2 = normalizeStateKey(shape.rawName);
  if (t === s1 || t === s2) return true;
  if (t === 'ladakh' && s1 === 'jammuandkashmir') return true;
  if (t === 'orissa' && s1 === 'odisha') return true;
  if (t === 'uttaranchal' && s1 === 'uttarakhand') return true;
  if (t === 'pondicherry' && s1 === 'puducherry') return true;
  if (t.includes('dadra') && s1.includes('dadra')) return true;
  if (t.includes('daman') && s1.includes('daman')) return true;
  return false;
}

interface BloodBankMarkerProps {
  center: BloodCenter;
  isSelected: boolean;
  onSelect: (center: BloodCenter, marker: google.maps.marker.AdvancedMarkerElement) => void;
}

function BloodBankMarker({ center, isSelected, onSelect }: BloodBankMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: center.latitude, lng: center.longitude }}
      title={center.name}
      zIndex={isSelected ? 1000 : 10}
      onClick={() => {
        if (marker) {
          onSelect(center, marker);
        }
      }}
    >
      <Pin
        background={isSelected ? '#FFFFFF' : '#E11D48'}
        borderColor={isSelected ? '#BE123C' : '#881337'}
        glyphColor={isSelected ? '#BE123C' : '#FFFFFF'}
      />
    </AdvancedMarker>
  );
}

function GoogleStreetMapCanvas({
  userCoords,
  gpsCoords,
  currentCity,
  currentState,
  centers,
  selectedCenter,
  onSelectCenter,
  onMapTapCoords,
  onOpenLogDonation,
  pendingBounds,
  onConsumedBounds,
  pendingFlyTo,
  onConsumedFlyTo,
  onMapReady,
}: {
  userCoords: { lat: number; lng: number } | null;
  gpsCoords: { lat: number; lng: number } | null;
  currentCity: string;
  currentState: string | null;
  centers: BloodCenter[];
  selectedCenter: BloodCenter | null;
  onSelectCenter: (c: BloodCenter | null) => void;
  onMapTapCoords: (coords: { lat: number; lng: number }) => void;
  onOpenLogDonation: (center: BloodCenter) => void;
  pendingBounds: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null;
  onConsumedBounds: () => void;
  pendingFlyTo: { lat: number; lng: number; zoom: number } | null;
  onConsumedFlyTo: () => void;
  onMapReady: (map: google.maps.Map | null) => void;
}) {
  const apiLoaded = useApiIsLoaded();
  const apiStatus = useApiLoadingStatus();
  const map = useMap('india-street-map');
  const initializedRef = useRef(false);
  const [selectedMarker, setSelectedMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [userPinRef, userPinMarker] = useAdvancedMarkerRef();
  const [showUserInfo, setShowUserInfo] = useState(false);

  useEffect(() => {
    onMapReady(map ?? null);
    return () => onMapReady(null);
  }, [map, onMapReady]);

  useEffect(() => {
    if (!map) return;
    if (!initializedRef.current) {
      if (pendingFlyTo) {
        map.panTo({ lat: pendingFlyTo.lat, lng: pendingFlyTo.lng });
        map.setZoom(pendingFlyTo.zoom);
        onConsumedFlyTo();
      } else if (pendingBounds) {
        map.fitBounds(pendingBounds, { top: 24, bottom: 140, left: 16, right: 16 });
        onConsumedBounds();
      } else if (userCoords) {
        map.panTo(userCoords);
        map.setZoom(7);
      } else {
        map.fitBounds(INDIA_BOUNDS, { top: 24, bottom: 130, left: 12, right: 12 });
      }
      initializedRef.current = true;
    } else if (pendingFlyTo) {
      map.panTo({ lat: pendingFlyTo.lat, lng: pendingFlyTo.lng });
      const targetZoom = pendingFlyTo.zoom;
      onConsumedFlyTo();
      const timer = setTimeout(() => {
        map.setZoom(targetZoom);
      }, 280);
      return () => clearTimeout(timer);
    } else if (pendingBounds) {
      map.fitBounds(pendingBounds, { top: 24, bottom: 140, left: 16, right: 16 });
      onConsumedBounds();
    }
  }, [map, pendingBounds, onConsumedBounds, pendingFlyTo, onConsumedFlyTo, userCoords]);

  if (apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center space-y-2">
        <MapPin className="w-9 h-9 text-amber-300" aria-hidden="true" />
        <p className="text-sm font-medium text-white">Unable to load street map</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        id="india-street-map"
        mapId="DEMO_MAP_ID"
        defaultCenter={userCoords ?? INDIA_CENTER}
        defaultZoom={userCoords ? 7 : 4}
        gestureHandling="greedy"
        disableDefaultUI
        colorScheme="DARK"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
        onClick={(ev) => {
          const latLng = ev.detail.latLng;
          if (latLng) {
            onSelectCenter(null);
            setSelectedMarker(null);
            onMapTapCoords({ lat: latLng.lat, lng: latLng.lng });
          }
        }}
      >
        {gpsCoords && (
          <>
            <AdvancedMarker
              ref={userPinRef}
              position={gpsCoords}
              zIndex={1200}
              onClick={() => setShowUserInfo((v) => !v)}
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute w-8 h-8 rounded-full bg-sky-400/45 animate-ping" />
                <span className="w-4 h-4 rounded-full bg-[#0EA5E9] border-2 border-white shadow-lg" />
              </div>
            </AdvancedMarker>
            {showUserInfo && userPinMarker && (
              <InfoWindow anchor={userPinMarker} onCloseClick={() => setShowUserInfo(false)}>
                <div className="text-slate-900 text-xs px-1 py-0.5 space-y-0.5">
                  <div className="font-bold">Your GPS Location</div>
                  <div className="text-slate-600">
                    {currentState
                      ? currentCity !== currentState && currentCity !== 'India'
                        ? `${currentCity}, ${currentState}`
                        : currentState
                      : currentCity}
                  </div>
                </div>
              </InfoWindow>
            )}
          </>
        )}

        {centers.map((center) => (
          <BloodBankMarker
            key={center.id}
            center={center}
            isSelected={selectedCenter?.id === center.id}
            onSelect={(c, marker) => {
              onSelectCenter(c);
              setSelectedMarker(marker);
              if (map) map.panTo({ lat: c.latitude, lng: c.longitude });
            }}
          />
        ))}

        {selectedCenter && selectedMarker && (
          <InfoWindow
            anchor={selectedMarker}
            onCloseClick={() => {
              onSelectCenter(null);
              setSelectedMarker(null);
            }}
          >
            <div className="text-slate-900 max-w-[200px] space-y-1.5 text-xs">
              <div className="font-bold leading-snug">{selectedCenter.name}</div>
              <div className="text-[11px] text-slate-600 leading-snug">
                {selectedCenter.address}
              </div>
              <button
                type="button"
                onClick={() => onOpenLogDonation(selectedCenter)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-[#BE123C] text-white font-semibold text-[11px]"
              >
                Log Donation Here
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {!apiLoaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#14070E]/60">
          <div className="px-4 py-2 rounded-full bg-[#240D19] border border-white/15 text-xs text-white inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-rose-300" />
            Loading Street Map...
          </div>
        </div>
      )}
    </div>
  );
}

function unprojectIndiaPoint(x: number, y: number): { lat: number; lng: number } {
  const scale = 650.384524;
  const lng = 68 + ((x - 12) / scale) * (180 / Math.PI);
  const merc = 0.702557 - (y - 12) / scale;
  const lat = (2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

interface IndiaMapContentProps extends Omit<IndiaMapModalProps, 'isOpen'> {
  geocodingLib: google.maps.GeocodingLibrary | null;
  placesLib: google.maps.PlacesLibrary | null;
}

function IndiaMapContent({
  onClose,
  hasApiKey,
  geocodingLib,
  placesLib,
  userCoords,
  gpsCoords,
  currentCity,
  currentState,
  centers,
  onLocationUpdated,
  onCentersUpdated,
  onOpenLogDonation,
}: IndiaMapContentProps) {
  const [viewMode, setViewMode] = useState<'states' | 'street'>('states');
  const [searchText, setSearchText] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [browserPermState, setBrowserPermState] = useState<
    'prompt' | 'granted' | 'denied' | 'unknown'
  >('unknown');
  const [selectedCenter, setSelectedCenter] = useState<BloodCenter | null>(null);
  const [pendingBounds, setPendingBounds] = useState<
    google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null
  >(null);
  const [pendingFlyTo, setPendingFlyTo] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const [mapNotice, setMapNotice] = useState<string>(
    currentState
      ? `Located state: ${currentState}`
      : 'Tap Turn On Location to locate your state'
  );

  // Zoom & Pan state for the Red India States vector map and Street Map controls
  const [svgZoom, setSvgZoom] = useState(1);
  const [svgPan, setSvgPan] = useState({ x: 0, y: 0 });
  const svgZoomRef = useRef(svgZoom);
  const svgPanRef = useRef(svgPan);
  const rafRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const streetMapRef = useRef<google.maps.Map | null>(null);
  const centerCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, origPanX: 0, origPanY: 0, moved: false });
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!selectedCenter) return;
    const cardEl = centerCardRefs.current[selectedCenter.id];
    cardEl?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedCenter]);

  useEffect(() => {
    svgZoomRef.current = svgZoom;
  }, [svgZoom]);

  useEffect(() => {
    svgPanRef.current = svgPan;
  }, [svgPan]);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  const clampPan = useCallback((x: number, y: number, zoom: number) => {
    if (zoom <= 1.02) return { x: 0, y: 0 };
    const maxX = 165 * (zoom - 1);
    const maxY = 185 * (zoom - 1);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const animateSvgFocus = useCallback(
    (targetPoint: { x: number; y: number }, targetZoom: number, duration = 780) => {
      stopAnimation();
      const startZoom = svgZoomRef.current;
      const startPanX = svgPanRef.current.x;
      const startPanY = svgPanRef.current.y;
      const clampedZoom = Math.max(1, Math.min(6, Number(targetZoom.toFixed(2))));
      const endPan = clampPan(
        (180 - targetPoint.x) * clampedZoom,
        (203.5 - targetPoint.y) * clampedZoom,
        clampedZoom
      );
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const nextZoom = Number((startZoom + (clampedZoom - startZoom) * eased).toFixed(3));
        const nextPanX = startPanX + (endPan.x - startPanX) * eased;
        const nextPanY = startPanY + (endPan.y - startPanY) * eased;

        setSvgZoom(nextZoom);
        setSvgPan({ x: nextPanX, y: nextPanY });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [clampPan, stopAnimation]
  );

  const applySvgZoom = useCallback(
    (nextZoom: number) => {
      stopAnimation();
      const clamped = Math.max(1, Math.min(6, Number(nextZoom.toFixed(2))));
      setSvgZoom(clamped);
      setSvgPan((prev) => clampPan(prev.x, prev.y, clamped));
    },
    [clampPan, stopAnimation]
  );

  const handleZoomIn = useCallback(() => {
    if (viewMode === 'street' && streetMapRef.current) {
      const current = streetMapRef.current.getZoom() ?? 5;
      streetMapRef.current.setZoom(Math.min(18, current + 1));
      return;
    }
    applySvgZoom(svgZoom >= 2.5 ? svgZoom + 0.9 : svgZoom + 0.6);
  }, [viewMode, svgZoom, applySvgZoom]);

  const handleZoomOut = useCallback(() => {
    if (viewMode === 'street' && streetMapRef.current) {
      const current = streetMapRef.current.getZoom() ?? 5;
      streetMapRef.current.setZoom(Math.max(3, current - 1));
      return;
    }
    applySvgZoom(svgZoom >= 2.5 ? svgZoom - 0.9 : svgZoom - 0.6);
  }, [viewMode, svgZoom, applySvgZoom]);

  const handleResetZoom = useCallback(() => {
    if (viewMode === 'street' && streetMapRef.current) {
      streetMapRef.current.fitBounds(INDIA_BOUNDS, {
        top: 24,
        bottom: 130,
        left: 12,
        right: 12,
      });
      return;
    }
    animateSvgFocus({ x: 180, y: 203.5 }, 1, 520);
  }, [viewMode, animateSvgFocus]);

  const projectedUser = useMemo(() => {
    if (!gpsCoords) return null;
    if (
      gpsCoords.lat < 6.4 ||
      gpsCoords.lat > 37.5 ||
      gpsCoords.lng < 67.8 ||
      gpsCoords.lng > 97.8
    ) {
      return null;
    }
    return projectIndiaLatLng(gpsCoords.lat, gpsCoords.lng);
  }, [gpsCoords]);

  const projectedCenters = useMemo(
    () =>
      centers
        .filter(
          (c) =>
            c.latitude >= 6.4 &&
            c.latitude <= 37.5 &&
            c.longitude >= 67.8 &&
            c.longitude <= 97.8
        )
        .map((c) => ({
          center: c,
          point: projectIndiaLatLng(c.latitude, c.longitude),
        })),
    [centers]
  );

  const fetchBloodBanksForArea = useCallback(
    async (
      areaLabel: string,
      fallbackCity: string,
      stateName: string | null,
      biasCoords?: { lat: number; lng: number }
    ) => {
      if (!placesLib) return;
      try {
        const insideIndia =
          !biasCoords ||
          (biasCoords.lat >= 6.4 &&
            biasCoords.lat <= 37.5 &&
            biasCoords.lng >= 67.8 &&
            biasCoords.lng <= 97.8);

        const request: google.maps.places.SearchByTextRequest = {
          textQuery: insideIndia
            ? `blood bank in ${areaLabel}, India`
            : `blood bank near ${areaLabel}`,
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'businessStatus'],
          ...(insideIndia ? { region: 'in' } : {}),
          ...(biasCoords
            ? { locationBias: { center: biasCoords, radius: 25000 } }
            : {}),
          language: 'en',
          maxResultCount: 10,
        };
        const { places } = await placesLib.Place.searchByText({
          ...request,
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
        } as google.maps.places.SearchByTextRequest);

        const mapped: BloodCenter[] = (places ?? [])
          .filter((p) => p.location != null)
          .map((p, index) => ({
            id: p.id || `place-${index}`,
            name: p.displayName || 'Blood Bank',
            city: fallbackCity,
            state: stateName ?? undefined,
            address: p.formattedAddress || `${areaLabel}`,
            hours:
              p.businessStatus === 'OPERATIONAL' ? 'Operational' : 'Check hours on visit',
            latitude: p.location!.lat(),
            longitude: p.location!.lng(),
            neededTypes: ['O-', 'O+', 'A+'],
          }));

        onCentersUpdated(mapped);
        if (mapped.length > 0) {
          setMapNotice(`${stateName || areaLabel} · ${mapped.length} blood banks nearby`);
        } else {
          setMapNotice(`Located ${stateName || areaLabel}`);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    },
    [placesLib, onCentersUpdated]
  );

  const locateStateFromCoords = useCallback(
    async (coords: { lat: number; lng: number }, source: 'gps' | 'tap' = 'tap') => {
      setIsSearching(true);
      const insideIndia =
        coords.lat >= 6.4 &&
        coords.lat <= 37.5 &&
        coords.lng >= 67.8 &&
        coords.lng <= 97.8;

      if (source === 'gps') {
        setPendingFlyTo({ lat: coords.lat, lng: coords.lng, zoom: 13 });
        if (insideIndia) {
          animateSvgFocus(projectIndiaLatLng(coords.lat, coords.lng), 3.2, 850);
        } else if (hasApiKey) {
          setViewMode('street');
        }
      }

      try {
        if (geocodingLib) {
          const geocoder = new geocodingLib.Geocoder();
          const { results } = await geocoder.geocode({ location: coords });
          if (results && results.length > 0) {
            const stateResult = results.find((r) =>
              r.types.includes('administrative_area_level_1')
            );
            const comps = results[0].address_components ?? [];
            const stateComp = comps.find((c) =>
              c.types.includes('administrative_area_level_1')
            );
            const cityComp =
              comps.find((c) => c.types.includes('locality')) ||
              comps.find((c) => c.types.includes('administrative_area_level_2'));

            const detectedState =
              stateComp?.long_name ||
              stateResult?.address_components?.find((c) =>
                c.types.includes('administrative_area_level_1')
              )?.long_name ||
              null;
            const detectedCity = cityComp?.long_name || detectedState || 'Current Location';

            if (source === 'tap' && stateResult?.geometry?.viewport) {
              setPendingBounds(stateResult.geometry.viewport);
            }

            onLocationUpdated({
              lat: coords.lat,
              lng: coords.lng,
              city: detectedCity,
              state: detectedState,
              isGps: source === 'gps',
            });

            const areaQuery =
              detectedState && detectedCity !== detectedState
                ? `${detectedCity}, ${detectedState}`
                : detectedState || detectedCity;

            setMapNotice(
              detectedState
                ? `Located: ${detectedCity !== detectedState ? `${detectedCity}, ` : ''}${detectedState}`
                : `Located: ${detectedCity}`
            );

            await fetchBloodBanksForArea(areaQuery, detectedCity, detectedState, coords);
            return;
          }
        }

        // Fallback reverse geocoding if Maps Geocoder hasn't loaded yet
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lng}&localityLanguage=en`
        );
        if (res.ok) {
          const data = await res.json();
          const detectedState = data.principalSubdivision || null;
          const detectedCity = data.city || data.locality || detectedState || 'Current Location';
          onLocationUpdated({
            lat: coords.lat,
            lng: coords.lng,
            city: detectedCity,
            state: detectedState,
            isGps: source === 'gps',
          });
          setMapNotice(
            detectedState
              ? `Located: ${detectedCity !== detectedState ? `${detectedCity}, ` : ''}${detectedState}`
              : `Located: ${detectedCity}`
          );
          await fetchBloodBanksForArea(
            detectedState && detectedCity !== detectedState
              ? `${detectedCity}, ${detectedState}`
              : detectedState || detectedCity,
            detectedCity,
            detectedState,
            coords
          );
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setMapNotice('Unable to detect state at this location.');
      } finally {
        setIsSearching(false);
      }
    },
    [geocodingLib, onLocationUpdated, fetchBloodBanksForArea, animateSvgFocus, hasApiKey]
  );

  const handleTurnOnLocation = () => {
    setShowLocationPrompt(true);
    if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          setBrowserPermState(status.state);
        })
        .catch(() => {
          setBrowserPermState('unknown');
        });
    }
  };

  const executeLocationPermissionGrant = () => {
    setShowLocationPrompt(false);
    if (!('geolocation' in navigator)) {
      setMapNotice('GPS location is unavailable on this device.');
      return;
    }
    setIsLocating(true);
    setMapNotice('Checking device GPS location...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setIsLocating(false);
        setMapNotice('Location granted · Flying to your location...');
        onLocationUpdated({
          lat: coords.lat,
          lng: coords.lng,
          city: currentCity,
          state: currentState,
          isGps: true,
        });
        await locateStateFromCoords(coords, 'gps');
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setBrowserPermState('denied');
          setMapNotice(
            'Browser blocked GPS access. Allow location in site settings or tap your state.'
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setMapNotice('GPS signal unavailable right now. Try again or tap a state.');
        } else {
          setMapNotice('Location timed out. Tap Turn On Location to retry.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSelectStateShape = async (shape: IndiaStateShape) => {
    setSelectedCenter(null);
    setMapNotice(`Selected state: ${shape.name}`);
    const targetZoom = shape.area > 1200 ? 2.1 : shape.area > 350 ? 2.5 : 3.0;
    animateSvgFocus({ x: shape.cx, y: shape.cy }, targetZoom, 650);

    const fallbackCoords = unprojectIndiaPoint(shape.cx, shape.cy);
    onLocationUpdated({
      lat: fallbackCoords.lat,
      lng: fallbackCoords.lng,
      city: shape.name,
      state: shape.name,
    });

    if (geocodingLib) {
      try {
        const geocoder = new geocodingLib.Geocoder();
        const { results } = await geocoder.geocode({
          address: `${shape.name}, India`,
          region: 'IN',
        });
        if (results?.[0]) {
          const loc = results[0].geometry.location;
          if (results[0].geometry.viewport) {
            setPendingBounds(results[0].geometry.viewport);
          }
          onLocationUpdated({
            lat: loc.lat(),
            lng: loc.lng(),
            city: shape.name,
            state: shape.name,
          });
        }
      } catch {
        // Keep shape highlight and unprojected coordinates even if geocoder fails
      }
    }

    await fetchBloodBanksForArea(shape.name, shape.name, shape.name);
  };

  const handleResetAllIndia = () => {
    setSelectedCenter(null);
    setSearchText('');
    setPendingFlyTo(null);
    setPendingBounds(INDIA_BOUNDS);
    animateSvgFocus({ x: 180, y: 203.5 }, 1, 560);
    onCentersUpdated([]);
    onLocationUpdated({
      lat: null,
      lng: null,
      city: 'India',
      state: null,
    });
    setMapNotice('Whole India · Tap Turn On Location or pick any state');
  };

  const handleStateSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    if (!q) return;

    // Try matching local India state shape first for instant highlight
    const matchedShape = INDIA_STATES_SVG.find(
      (s) =>
        normalizeStateKey(s.name).includes(normalizeStateKey(q)) ||
        normalizeStateKey(q).includes(normalizeStateKey(s.name))
    );

    if (!geocodingLib) {
      if (matchedShape) {
        await handleSelectStateShape(matchedShape);
      } else {
        setMapNotice(`No Indian state matched "${q}".`);
      }
      return;
    }

    setIsSearching(true);
    setSelectedCenter(null);
    try {
      const geocoder = new geocodingLib.Geocoder();
      const { results } = await geocoder.geocode({
        address: q.toLowerCase().includes('india') ? q : `${q}, India`,
        region: 'IN',
      });
      if (!results || results.length === 0) {
        setMapNotice(`No Indian state or city found for "${q}".`);
        return;
      }

      const best = results[0];
      const loc = best.geometry.location;
      const comps = best.address_components ?? [];
      const stateComp = comps.find((c) =>
        c.types.includes('administrative_area_level_1')
      );
      const cityComp =
        comps.find((c) => c.types.includes('locality')) ||
        comps.find((c) => c.types.includes('administrative_area_level_2'));

      const stateName = stateComp?.long_name ?? matchedShape?.name ?? null;
      const cityName = cityComp?.long_name || stateName || q;

      if (best.geometry.viewport) {
        setPendingBounds(best.geometry.viewport);
      }

      const lat = loc.lat();
      const lng = loc.lng();
      if (lat >= 6.4 && lat <= 37.5 && lng >= 67.8 && lng <= 97.8) {
        animateSvgFocus(projectIndiaLatLng(lat, lng), cityComp ? 2.8 : 2.3, 700);
      }

      onLocationUpdated({
        lat,
        lng,
        city: cityName,
        state: stateName,
      });

      await fetchBloodBanksForArea(
        stateName && cityName !== stateName ? `${cityName}, ${stateName}` : stateName || cityName,
        cityName,
        stateName
      );
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      if (matchedShape) {
        await handleSelectStateShape(matchedShape);
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      className="relative flex-1 min-h-0 flex flex-col overflow-hidden text-white"
      style={{
        background:
          'linear-gradient(180deg, #1A0A14 0%, #2D1020 44%, #44152B 78%, #1E0B16 100%)',
      }}
    >
      {/* Matching Home Page Ambient Crimson Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full blur-[95px] opacity-45"
          style={{
            background:
              'radial-gradient(circle, rgba(225,29,72,0.4) 0%, rgba(190,18,60,0.08) 60%, transparent 80%)',
          }}
        />
      </div>

      {/* Top Header */}
      <div className="relative z-20 shrink-0 px-3.5 pt-3 pb-2.5 border-b border-white/10 bg-[#1A0A14]/55 backdrop-blur-md space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to home"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white/10 hover:bg-white/18 flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 text-center">
            <div className="text-[10px] uppercase tracking-wider text-rose-200/75 font-semibold">
              India · States
            </div>
            <div className="text-sm font-semibold text-white truncate">
              {currentState
                ? currentCity !== currentState && currentCity !== 'India'
                  ? `${currentCity}, ${currentState}`
                  : currentState
                : 'All India'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {currentState && (
              <button
                type="button"
                onClick={handleResetAllIndia}
                className="min-h-[34px] px-2.5 rounded-full bg-white/10 hover:bg-white/18 text-[11px] font-medium text-rose-100 whitespace-nowrap transition-colors"
              >
                All India
              </button>
            )}
            {hasApiKey ? (
              <button
                type="button"
                onClick={() =>
                  setViewMode((prev) => (prev === 'states' ? 'street' : 'states'))
                }
                className="min-h-[34px] px-2.5 rounded-full bg-white/10 hover:bg-white/18 text-[11px] font-semibold text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                {viewMode === 'states' ? (
                  <>
                    <MapIcon className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
                    Street
                  </>
                ) : (
                  <>
                    <Compass className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
                    States
                  </>
                )}
              </button>
            ) : (
              !currentState && <div className="w-[40px]" />
            )}
          </div>
        </div>

        {/* Search Indian State or City */}
        <form onSubmit={handleStateSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-white/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search Indian state or city..."
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-[#12060D]/80 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-rose-400"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                aria-label="Clear search"
                className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white absolute right-1 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchText.trim()}
            className="h-9 px-3.5 rounded-xl bg-[#BE123C] hover:bg-[#E11D48] disabled:opacity-50 text-xs font-semibold text-white shrink-0 transition-colors"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
          </button>
        </form>
      </div>

      {/* Main Map Area */}
      <div className="relative z-10 flex-1 min-h-0 w-full flex flex-col">
        {viewMode === 'street' && hasApiKey ? (
          <GoogleStreetMapCanvas
            userCoords={userCoords}
            gpsCoords={gpsCoords}
            currentCity={currentCity}
            currentState={currentState}
            centers={centers}
            selectedCenter={selectedCenter}
            onSelectCenter={setSelectedCenter}
            onMapTapCoords={(coords) => void locateStateFromCoords(coords, 'tap')}
            onOpenLogDonation={onOpenLogDonation}
            pendingBounds={pendingBounds}
            onConsumedBounds={() => setPendingBounds(null)}
            pendingFlyTo={pendingFlyTo}
            onConsumedFlyTo={() => setPendingFlyTo(null)}
            onMapReady={(m) => {
              streetMapRef.current = m;
            }}
          />
        ) : (
          /* Crimson India States Map matching reference image & home page background */
          <div
            onWheel={(e) => {
              const delta = e.deltaY < 0 ? 0.35 : -0.35;
              applySvgZoom(svgZoom + delta);
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              if (pinchStartDistRef.current !== null) return;
              stopAnimation();
              dragStateRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                origPanX: svgPan.x,
                origPanY: svgPan.y,
                moved: false,
              };
            }}
            onPointerMove={(e) => {
              if (pinchStartDistRef.current !== null) return;
              const st = dragStateRef.current;
              if (!st.active || svgZoom <= 1) return;
              const dxScreen = e.clientX - st.startX;
              const dyScreen = e.clientY - st.startY;
              if (Math.abs(dxScreen) > 5 || Math.abs(dyScreen) > 5) {
                st.moved = true;
              }
              if (!st.moved) return;
              const rect = svgRef.current?.getBoundingClientRect();
              const scaleFactor = rect && rect.width > 0 ? 360 / rect.width : 1;
              const nextPan = clampPan(
                st.origPanX + dxScreen * scaleFactor,
                st.origPanY + dyScreen * scaleFactor,
                svgZoom
              );
              setSvgPan(nextPan);
            }}
            onPointerUp={() => {
              if (dragStateRef.current.moved) {
                suppressClickRef.current = true;
                setTimeout(() => {
                  suppressClickRef.current = false;
                }, 60);
              }
              dragStateRef.current.active = false;
            }}
            onPointerCancel={() => {
              dragStateRef.current.active = false;
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                dragStateRef.current.active = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchStartDistRef.current = Math.hypot(dx, dy);
                pinchStartZoomRef.current = svgZoom;
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && pinchStartDistRef.current) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const ratio = dist / pinchStartDistRef.current;
                applySvgZoom(pinchStartZoomRef.current * ratio);
              }
            }}
            onTouchEnd={() => {
              pinchStartDistRef.current = null;
            }}
            className={`relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden px-2 pt-8 touch-none ${
              centers.length > 0 ? 'pb-[132px]' : 'pb-[94px]'
            } ${svgZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            <svg
              ref={svgRef}
              viewBox={INDIA_SVG_VIEWBOX}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full max-h-full select-none"
              role="img"
              aria-label="Interactive India States Map"
            >
              <g
                transform={`translate(${180 + svgPan.x} ${203.5 + svgPan.y}) scale(${svgZoom}) translate(-180 -203.5)`}
              >
                {[...INDIA_STATES_SVG]
                  .sort(
                    (a, b) =>
                      Number(stateMatches(a, currentState)) -
                      Number(stateMatches(b, currentState))
                  )
                  .map((shape) => {
                    const isActive = stateMatches(shape, currentState);
                    const fill = isActive
                      ? '#E11D48'
                      : RED_SHADES[shape.shade % RED_SHADES.length];
                    const rawLabel = SHORT_STATE_LABELS[shape.name] ?? shape.name;
                    const offset = LABEL_OFFSETS[shape.name];
                    const lx = shape.cx + (offset?.dx ?? 0);
                    const ly = shape.cy + (offset?.dy ?? 0);
                    const invScale = 1 / Math.sqrt(svgZoom);

                    return (
                      <g
                        key={shape.id}
                        onClick={() => {
                          if (suppressClickRef.current) return;
                          void handleSelectStateShape(shape);
                        }}
                        className="cursor-pointer group"
                      >
                        <path
                          d={shape.d}
                          fill={fill}
                          fillOpacity={isActive ? 1 : 0.92}
                          stroke={isActive ? '#FFFFFF' : 'rgba(255, 214, 222, 0.5)'}
                          strokeWidth={(isActive ? 1.6 : 0.65) * invScale}
                          strokeLinejoin="round"
                          className="transition-colors duration-200 group-hover:fill-[#E11D48] group-hover:stroke-white/85"
                        />
                        {rawLabel && (shape.area >= 95 || isActive || svgZoom >= 1.8) && (
                          <text
                            x={lx}
                            y={ly}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={isActive ? '#FFFFFF' : 'rgba(255, 240, 244, 0.94)'}
                            fontSize={
                              (shape.area > 1200 ? 5.6 : shape.area > 350 ? 4.8 : 4.0) *
                              (svgZoom > 1.6 ? Math.max(0.58, 1 / Math.pow(svgZoom, 0.55)) : 1)
                            }
                            fontWeight={isActive ? '700' : '600'}
                            fontFamily="Plus Jakarta Sans, sans-serif"
                            className="pointer-events-none"
                            style={{
                              paintOrder: 'stroke',
                              stroke: 'rgba(20, 5, 12, 0.88)',
                              strokeWidth: 1.35 * invScale,
                              strokeLinejoin: 'round',
                            }}
                          >
                            {rawLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}

                {/* Blood Bank Dots projected onto the Red India Map */}
                {projectedCenters.map(({ center, point }) => {
                  const isSel = selectedCenter?.id === center.id;
                  const invScale = 1 / Math.sqrt(svgZoom);
                  return (
                    <g
                      key={center.id}
                      transform={`translate(${point.x}, ${point.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressClickRef.current) return;
                        setSelectedCenter(center);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        r={(isSel ? 4.8 : 3.2) * invScale}
                        fill={isSel ? '#FFFFFF' : '#FECDD3'}
                        stroke="#881337"
                        strokeWidth={1.2 * invScale}
                      />
                    </g>
                  );
                })}

                {/* Located User GPS Beacon projected onto the State */}
                {projectedUser && (
                  <g
                    transform={`translate(${projectedUser.x}, ${projectedUser.y})`}
                    className="pointer-events-none"
                  >
                    <circle
                      r={5 / Math.sqrt(svgZoom)}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={1.4 / Math.sqrt(svgZoom)}
                    >
                      <animate
                        attributeName="r"
                        from={String(4.5 / Math.sqrt(svgZoom))}
                        to={String(16 / Math.sqrt(svgZoom))}
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.85"
                        to="0"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle
                      r={7.5 / Math.sqrt(svgZoom)}
                      fill="rgba(56, 189, 248, 0.28)"
                    />
                    <circle
                      r={4.8 / Math.sqrt(svgZoom)}
                      fill="#0EA5E9"
                      stroke="#FFFFFF"
                      strokeWidth={2 / Math.sqrt(svgZoom)}
                    />
                    <text
                      x={0}
                      y={-10 / Math.sqrt(svgZoom)}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize={5.8 / Math.sqrt(svgZoom)}
                      fontWeight="700"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      style={{
                        paintOrder: 'stroke',
                        stroke: 'rgba(18, 4, 10, 0.95)',
                        strokeWidth: 1.8 / Math.sqrt(svgZoom),
                        strokeLinejoin: 'round',
                      }}
                    >
                      You
                    </text>
                  </g>
                )}
              </g>
            </svg>
          </div>
        )}

        {/* Floating Notice Pill */}
        <div className="pointer-events-none absolute top-2 inset-x-3 flex justify-center z-20">
          <div className="max-w-full px-3 py-1 rounded-full bg-[#1C0A14]/85 border border-rose-200/20 backdrop-blur-md text-[11px] font-medium text-rose-50 text-center shadow-lg">
            {mapNotice}
          </div>
        </div>

        {/* Zoom In / Zoom Out Controls */}
        <div
          className={`absolute right-3 z-20 flex flex-col items-center rounded-2xl bg-[#1D0B14]/88 border border-rose-200/20 backdrop-blur-md shadow-[0_8px_22px_rgba(12,2,8,0.6)] overflow-hidden ${
            centers.length > 0 ? 'bottom-[170px]' : 'bottom-[132px]'
          }`}
        >
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={viewMode === 'states' && svgZoom >= 6}
            aria-label="Zoom in"
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/12 disabled:opacity-35 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>

          {viewMode === 'states' && (
            <div className="w-full py-0.5 text-center text-[10px] font-semibold text-rose-200/85 tabular-nums border-y border-white/10 bg-black/20 select-none">
              {svgZoom.toFixed(1)}x
            </div>
          )}

          <button
            type="button"
            onClick={handleZoomOut}
            disabled={viewMode === 'states' && svgZoom <= 1}
            aria-label="Zoom out"
            className={`w-10 h-10 flex items-center justify-center text-white hover:bg-white/12 disabled:opacity-35 transition-colors ${
              viewMode === 'street' ? 'border-t border-white/10' : ''
            }`}
          >
            <Minus className="w-4 h-4" aria-hidden="true" />
          </button>

          {(viewMode === 'street' || svgZoom > 1) && (
            <button
              type="button"
              onClick={handleResetZoom}
              aria-label="Reset zoom"
              className="w-10 h-9 flex items-center justify-center text-rose-200 hover:bg-white/12 border-t border-white/10 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Turn On Location CTA Button */}
        <button
          type="button"
          onClick={handleTurnOnLocation}
          disabled={isLocating || isSearching}
          className={`absolute right-3 z-20 min-h-[42px] px-3.5 py-2 rounded-full bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-60 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(12,2,8,0.65)] border border-rose-200/40 inline-flex items-center gap-1.5 transition-all active:scale-95 ${
            centers.length > 0 ? 'bottom-[120px]' : 'bottom-[82px]'
          }`}
        >
          {isLocating || isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="w-4 h-4" aria-hidden="true" />
          )}
          Turn On Location
        </button>

        {/* Bottom Tray: Located State & Real Nearby Blood Banks */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#12060D] via-[#1C0A14]/92 to-transparent pt-5 pb-3 px-3">
          {centers.length === 0 ? (
            <div className="rounded-2xl border border-white/14 bg-[#260E1B]/85 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  {currentState ? `Located State: ${currentState}` : 'All India States'}
                </div>
                <div className="text-[11px] text-rose-100/65 truncate">
                  Tap &ldquo;Turn On Location&rdquo; or tap any state on the map
                </div>
              </div>
              <Droplet className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-0.5">
              {centers.map((center) => {
                const distOrigin = gpsCoords ?? userCoords;
                const dist = distOrigin
                  ? distanceKm(
                      distOrigin.lat,
                      distOrigin.lng,
                      center.latitude,
                      center.longitude
                    )
                  : null;
                const active = selectedCenter?.id === center.id;

                return (
                  <div
                    key={center.id}
                    ref={(el) => {
                      centerCardRefs.current[center.id] = el;
                    }}
                    className={`shrink-0 w-[230px] rounded-2xl border p-2.5 backdrop-blur-xl transition-colors ${
                      active
                        ? 'border-rose-300/65 bg-[#46162E]/95'
                        : 'border-white/14 bg-[#240D1A]/90'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCenter(center);
                        if (viewMode === 'street' && streetMapRef.current) {
                          streetMapRef.current.panTo({ lat: center.latitude, lng: center.longitude });
                          streetMapRef.current.setZoom(Math.max(13, streetMapRef.current.getZoom() ?? 13));
                        } else if (
                          center.latitude >= 6.4 &&
                          center.latitude <= 37.5 &&
                          center.longitude >= 67.8 &&
                          center.longitude <= 97.8
                        ) {
                          animateSvgFocus(
                            projectIndiaLatLng(center.latitude, center.longitude),
                            Math.max(svgZoomRef.current, 2.8),
                            520
                          );
                        }
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-semibold text-white truncate">
                          {center.name}
                        </div>
                        {dist !== null && (
                          <span className="text-[10px] font-semibold text-rose-200 tabular-nums shrink-0">
                            {dist < 10 ? dist.toFixed(1) : Math.round(dist)} km
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/60 truncate mt-0.5">
                        {center.address}
                      </div>
                    </button>

                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-emerald-300 font-medium">
                        {center.hours}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenLogDonation(center)}
                        className="px-2.5 py-1 rounded-lg bg-[#BE123C] hover:bg-[#E11D48] text-[10px] font-semibold text-white transition-colors"
                      >
                        Log Visit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Android-Style Location Permission Pop-up */}
        {showLocationPrompt && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="location-perm-title"
            className="absolute inset-0 z-30 flex items-center justify-center p-5 bg-[#0C0308]/75 backdrop-blur-sm"
          >
            <div className="w-full max-w-[300px] rounded-[26px] border border-rose-200/20 bg-gradient-to-b from-[#2E1121] to-[#1B0913] p-5 text-center shadow-[0_24px_60px_rgba(0,0,0,0.85)]">
              <div className="mx-auto w-11 h-11 rounded-2xl bg-[#E11D48]/20 border border-rose-300/30 flex items-center justify-center mb-3">
                <MapPin className="w-5 h-5 text-rose-300" aria-hidden="true" />
              </div>

              <h2
                id="location-perm-title"
                className="text-[15px] font-semibold text-white leading-snug"
              >
                Allow PulseDrop to access this device&apos;s location?
              </h2>

              <p className="mt-1.5 text-xs text-rose-100/70 leading-relaxed">
                Your GPS location detects your Indian state, animates the map to you, and loads
                nearby blood banks.
              </p>

              {browserPermState === 'denied' && (
                <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-300/30 text-[11px] text-amber-100 leading-snug">
                  Browser location is currently blocked. Enable Location in your address bar or site
                  settings, then tap below.
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={executeLocationPermissionGrant}
                  className="w-full min-h-[42px] rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white shadow-lg transition-colors active:scale-[0.98]"
                >
                  While using the app
                </button>
                <button
                  type="button"
                  onClick={executeLocationPermissionGrant}
                  className="w-full min-h-[40px] rounded-xl bg-white/10 hover:bg-white/16 text-xs font-medium text-white border border-white/10 transition-colors"
                >
                  Only this time
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationPrompt(false);
                    setMapNotice('Location permission skipped · Tap any state on the map');
                  }}
                  className="w-full min-h-[38px] rounded-xl text-xs font-medium text-rose-200/75 hover:text-white hover:bg-white/6 transition-colors"
                >
                  Don&apos;t allow
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IndiaMapContentWithMaps(props: Omit<IndiaMapModalProps, 'isOpen'>) {
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');

  return (
    <IndiaMapContent
      {...props}
      geocodingLib={geocodingLib}
      placesLib={placesLib}
    />
  );
}

export function IndiaMapModal({
  isOpen,
  onClose,
  hasApiKey,
  ...rest
}: IndiaMapModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="India Blood Map"
      className="absolute inset-0 z-40 flex flex-col bg-[#1A0A14]"
    >
      {hasApiKey ? (
        <IndiaMapContentWithMaps onClose={onClose} hasApiKey={hasApiKey} {...rest} />
      ) : (
        <IndiaMapContent
          onClose={onClose}
          hasApiKey={hasApiKey}
          geocodingLib={null}
          placesLib={null}
          {...rest}
        />
      )}
    </div>
  );
}
