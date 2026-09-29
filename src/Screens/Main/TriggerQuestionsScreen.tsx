import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Platform, ActivityIndicator, Linking, Image, Alert, Modal, FlatList, PermissionsAndroid, LayoutAnimation, UIManager, LogBox } from 'react-native';
import { ArrowLeft, Clock, Upload, Sparkles, FileText, Camera, Settings, Plus, Trash, Edit, ChevronDown } from 'lucide-react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import BASE_URL, { IMAGE_BASE_URL } from '../../baseurl';
import {
  useGetGroupedTriggersQuery,
  useCreateTriggerMutation,
  useUpdateTriggerMutation,
  useDeleteTriggerMutation,
  useGetTriggerCategoriesQuery,
  useCreateTriggerCategoryMutation
} from '../../Redux/api/triggerApi';
import { useUploadCaseDocumentMutation } from '../../Redux/api/updateApi';
import { useGetCaseDetailsQuery, useSubmitFieldReportMutation } from '../../Redux/api';
import { useAuth } from '../../contexts/AuthContext';

LogBox.ignoreLogs(['setLayoutAnimationEnabledExperimental is currently a no-op']);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  const isFabricEnabled = (globalThis as any)._IS_FABRIC;
  if (!isFabricEnabled) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function TriggerQuestionsScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const routeCaseData = route.params?.caseData;
  const caseId = routeCaseData?.id || route.params?.id;

  // If we navigated here directly from AssignedCases, checklist_config is missing
  const needsFetch = !!caseId && !routeCaseData?.checklist_config && !route.params?.triggerData;
  const { data: fetchedCaseData, isLoading: isCaseLoading } = useGetCaseDetailsQuery(caseId, { skip: !needsFetch });

  const caseData = needsFetch ? (fetchedCaseData || routeCaseData) : routeCaseData;

  const isLoading = isCaseLoading;

  const [showAdminModal, setShowAdminModal] = useState(false);
  const { data: allTriggersData, isLoading: triggersLoading, refetch: refetchTriggers } = useGetGroupedTriggersQuery(undefined, { skip: !showAdminModal });
  const { data: categoriesData } = useGetTriggerCategoriesQuery(undefined, { skip: !showAdminModal });
  const [createTrigger] = useCreateTriggerMutation();
  const [updateTrigger] = useUpdateTriggerMutation();
  const [deleteTrigger] = useDeleteTriggerMutation();
  const [createCategory] = useCreateTriggerCategoryMutation();

  const [newTriggerTitle, setNewTriggerTitle] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [uploadTimestamps, setUploadTimestamps] = useState<Record<string, string[]>>({});

  const [submitFieldReport, { isLoading: submitting }] = useSubmitFieldReportMutation();
  const [uploadCaseDocument, { isLoading: uploading }] = useUploadCaseDocumentMutation();

  const triggerData = useMemo(() => {
    // Fallback to route params or existing checklist_config
    if (route.params?.triggerData) return route.params.triggerData;

    let config = caseData?.checklist_config;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch { console.log('Error parsing checklist_config'); }
    }

    if (!config || !Array.isArray(config)) {
      return [];
    }

    const normalizeType = (type: string, label: string = '') => {
      let tLower = (type || '').toLowerCase();
      const lLower = (label || '').toLowerCase();

      if (tLower === 'document' || tLower === 'photo' || tLower === 'image' || tLower === 'file') return 'document';
      if (tLower.includes('yes/no') || tLower === 'yesno' || tLower === 'radio') return 'yesno';
      if (tLower === 'text') return 'text';
      if (tLower === 'dropdown') return 'dropdown';
      if (tLower === 'table' || tLower === 'table-side') return 'table';

      if (lLower.includes('photo') || lLower.includes('document') || lLower.includes('upload') || lLower.includes('picture') || lLower.includes('image') || lLower.includes('file')) {
        return 'document';
      }

      return 'text';
    };

    const parseOptions = (options: any, type: string) => {
      let arr: any[] = [];
      if (Array.isArray(options) && options.length > 0) {
        arr = options;
      } else if (typeof options === 'string') {
        try {
          const parsed = JSON.parse(options);
          if (Array.isArray(parsed) && parsed.length > 0) arr = parsed;
        } catch {
          try {
            // Safer quote replacement for JS arrays disguised as strings
            const fixed = options.replace(/\['/g, '["').replace(/'\]/g, '"]').replace(/',/g, '",').replace(/,'/g, ',"');
            const parsed = JSON.parse(fixed);
            if (Array.isArray(parsed) && parsed.length > 0) arr = parsed;
          } catch { }
        }
        if (arr.length === 0) {
          arr = options.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
        }
      }
      if (arr.length === 0 && type === 'yesno') arr = ['Yes', 'No'];

      return arr.map((opt: any) => {
        let str = '';
        if (typeof opt === 'string') {
          str = opt.trim();
        } else if (opt !== null && typeof opt === 'object') {
          str = String(opt.label || opt.name || opt.value || opt.text || opt.title || opt.val || '').trim();
          if (!str) str = String(opt).trim();
        } else {
          str = String(opt).trim();
        }
        const parts = str.includes(';;') ? str.split(';;') : str.split('::');

        const isObj = (typeof opt === 'object' && opt !== null);

        const parsedName = parts[0] ? parts[0].trim() : str;

        let parsedHasSub = false;
        if (isObj && 'hasSub' in opt) {
          const hsStr = String(opt.hasSub).toLowerCase();
          parsedHasSub = (hsStr === 'true' || opt.hasSub === true || hsStr === '1' || hsStr === 'yes');
        } else if (parts[1]) {
          const hsStr = parts[1].trim().toLowerCase();
          parsedHasSub = (hsStr === 'true' || hsStr === '1' || hsStr === 'yes');
        }

        return {
          raw: opt,
          name: parsedName,
          hasSub: parsedHasSub,
          subHeading: isObj && opt.subHeading ? opt.subHeading : (parts[2] ? parts[2].trim() : 'REMARKS'),
          subType: isObj && opt.subType ? opt.subType : (parts[3] ? parts[3].trim() : 'text')
        };
      });
    };

    const flattenSubParts = (qs: any[]) => {
      let result: any[] = [];
      if (!Array.isArray(qs)) return result;
      qs.forEach(q => {
        result.push(q);
        if (Array.isArray(q.subParts)) {
          result = result.concat(flattenSubParts(q.subParts));
        } else if (Array.isArray(q.sub_parts)) {
          result = result.concat(flattenSubParts(q.sub_parts));
        }
      });
      return result;
    };

    const items = config.map((t: any) => {
      let questions: any[] = [];
      let rawQuestions: any[] = [];
      let parsedSubTriggersRaw: any[] = [];
      let parsedSubTriggers: any[] = [];

      if (Array.isArray(t.sub_parts)) rawQuestions = flattenSubParts(t.sub_parts);
      else if (typeof t.sub_parts === 'string') {
        try { rawQuestions = flattenSubParts(JSON.parse(t.sub_parts)); } catch {
          try { rawQuestions = flattenSubParts(JSON.parse(t.sub_parts.replace(/'/g, '"'))); } catch { }
        }
      }

      if (Array.isArray(t.sub_triggers)) {
        parsedSubTriggersRaw = flattenSubParts(t.sub_triggers);
      } else if (typeof t.sub_triggers === 'string') {
        try {
          parsedSubTriggersRaw = flattenSubParts(JSON.parse(t.sub_triggers));
        } catch {
          try {
            parsedSubTriggersRaw = flattenSubParts(JSON.parse(t.sub_triggers.replace(/'/g, '"')));
          } catch { }
        }
      }

      const existingBaseLabels = new Set(rawQuestions.map((q: any) => {
        const lbl = q.label || q.text || q.question || q.title || '';
        return lbl.trim();
      }));
      const existingCleanedBaseLabels = new Set(rawQuestions.map((q: any) => {
        const lbl = q.label || q.text || q.question || q.title || '';
        return lbl.replace(/^(Photo|Document|Image|File):\s*/i, '').trim();
      }));

      parsedSubTriggers = parsedSubTriggersRaw.filter((st: any) => {
        if (!st.is_custom) return true;

        const stLabel = st.label || st.text || st.question || st.title || '';
        const cleanedSt = stLabel.replace(/^(Photo|Document|Image|File):\s*/i, '').trim();

        if (existingBaseLabels.has(cleanedSt) || existingCleanedBaseLabels.has(cleanedSt)) {
          return false;
        }
        return true;
      });

      if (rawQuestions.length === 0 && parsedSubTriggers.length > 0) {
        rawQuestions = [...parsedSubTriggers];
      } else if (parsedSubTriggers.length > 0) {
        const existingLabels = new Set(rawQuestions.map((q: any) => q.label || q.text || q.question || q.title || ''));
        parsedSubTriggers.forEach((st: any) => {
          const stLabel = st.label || st.text || st.question || st.title || '';
          if (!existingLabels.has(stLabel)) {
            rawQuestions.push(st);
            existingLabels.add(stLabel);
          }
        });
      }

      if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
        rawQuestions = rawQuestions.map(q => ({ ...q }));
        const flatQuestions: any[] = [];
        rawQuestions.forEach((q: any) => {
          const labelText = q.label || q.text || q.question || q.title || '';
          let allocatorVal = q.value !== undefined ? q.value : (q.allocatorValue || q.allocator_value);

          if (parsedSubTriggersRaw.length > 0) {
            const allMatches = parsedSubTriggersRaw.filter((st: any) => {
              const stLabel = st.label || st.text || st.question || st.title || '';
              const cleanedSt = stLabel.replace(/^(Photo|Document|Image|File):\s*/i, '').trim();
              const cleanedLt = labelText.replace(/^(Photo|Document|Image|File):\s*/i, '').trim();
              return cleanedSt === cleanedLt;
            });
            q.subTriggerCount = allMatches.length;
            if ((allocatorVal === undefined || allocatorVal === '') && allMatches.length > 0) {
              const matchedWithValue = allMatches.find((m: any) => m.value !== undefined || m.allocatorValue !== undefined || m.allocator_value !== undefined);
              const matched = matchedWithValue || allMatches[0];
              const mVal = matched.value !== undefined ? matched.value : (matched.allocatorValue !== undefined ? matched.allocatorValue : matched.allocator_value);
              if (mVal !== undefined && mVal !== null) {
                allocatorVal = mVal;
              }
            }
          }

          const finalType = normalizeType(q.verifyType || q.type, labelText);
          let tempOriginalName = '';

          if (finalType === 'document') {
            const allDocs = caseData?.documents || [];
            const triggerTitle = t.trigger || t.name || t.title || '';
            let questionDocs = allDocs.filter((d: any) =>
              d.doc_type === labelText ||
              d.doc_type === `${triggerTitle}_${labelText}` ||
              d.doc_type === `${triggerTitle}_${labelText.replace(/^:\s*/, '')}` ||
              d.doc_type === `${triggerTitle}_${labelText}_document` ||
              d.doc_type === `${triggerTitle}_${labelText}_photo` ||
              d.doc_type === `${triggerTitle}_${labelText.replace(/^:\s*/, '')}_document` ||
              d.doc_type === `${triggerTitle}_${labelText.replace(/^:\s*/, '')}_photo`
            );

            if (questionDocs.length === 0 && allocatorVal && !String(allocatorVal).includes('/')) {
              const possibleDocs = allDocs.filter((d: any) =>
                d.original_name === allocatorVal &&
                ((d.doc_type || '').includes(triggerTitle) || d.trigger_id === t.trigger_id || d.trigger_id === t.id)
              );
              const fallbackDoc = possibleDocs.find((d: any) => d.doc_type === `${triggerTitle}_photo` || d.doc_type === `${triggerTitle}_doc`) || possibleDocs[0];
              if (fallbackDoc) questionDocs = [fallbackDoc];
            }

            if (questionDocs.length > 0) {
              tempOriginalName = questionDocs.map((d: any) => d.original_name).join(', ');
              allocatorVal = questionDocs[0].path;
            }

            q.allocatorDocs = questionDocs;
          }

          if ((q.type || '').toLowerCase() === 'form') {
            const optionsArray = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? q.options.split(',') : []);
            const validCols = optionsArray.filter((c: string) => c.trim() !== '');

            const parsedCols = validCols.map((c: string) => {
              const cStr = c.trim();
              const parts = cStr.split(':');
              const role = parts.length > 2 ? parts.pop()?.toLowerCase().trim() || 'allocator' : 'allocator';
              const type = parts.length > 1 ? parts.pop()?.toLowerCase().trim() || 'text' : 'text';
              const label = parts.join(':').trim() || cStr;
              return { label, type, role, original: cStr };
            });

            const allocatorCols = parsedCols.filter((p: any) => p.role === 'allocator');
            const verifierCols = parsedCols.filter((p: any) => p.role === 'verifier');

            let parsedAllocVal: any = {};
            try { parsedAllocVal = typeof allocatorVal === 'string' ? JSON.parse(allocatorVal) : (allocatorVal || {}); } catch { parsedAllocVal = {}; }

            allocatorCols.forEach((ac: any) => {
              const fLabel = ac.label;
              const vc = verifierCols.find((v: any) => v.label === fLabel);
              const fType = vc?.type || ac.type || 'text';

              const fallbackLabel = fLabel.split(':')[0].trim();
              const finalAllocVal = parsedAllocVal[fLabel] !== undefined
                ? String(parsedAllocVal[fLabel])
                : (parsedAllocVal[fallbackLabel] !== undefined ? String(parsedAllocVal[fallbackLabel]) : '');

              flatQuestions.push({
                ...q,
                type: normalizeType(fType, fLabel),
                text: fLabel,
                options: [],
                allocatorValue: finalAllocVal,
                isFormPart: true,
                formParentLabel: labelText
              });
            });
          } else {
            flatQuestions.push({
              ...q,
              type: finalType,
              text: labelText,
              originalName: tempOriginalName,
              options: parseOptions(q.verifyOptions || q.options || q.choices || q.values || q.data, finalType),
              rawOptions: q.verifyOptions || q.options || q.choices || q.values || q.data,
              allocatorValue: (() => {
                if (allocatorVal === null || allocatorVal === undefined || allocatorVal === '') return '';
                if (typeof allocatorVal === 'object') return JSON.stringify(allocatorVal);
                return String(allocatorVal);
              })()
            });
          }
        });

        questions = flatQuestions.map((q, qIdx) => ({
          ...q,
          qKey: q.isFormPart ? `${t.trigger || t.name || t.title || 'trigger'}_${q.formParentLabel}_${q.text}_${qIdx}` : `${t.trigger || t.name || t.title || 'trigger'}_${qIdx}`
        }));
      }
      const triggerTitle = t.trigger || t.name || t.title || 'Unknown Trigger';

      let refFiles: any[] = [];
      if (Array.isArray(t.refFiles)) refFiles = t.refFiles;
      else if (Array.isArray(t.reference_files)) refFiles = t.reference_files;
      else if (Array.isArray(t.ref_files)) refFiles = t.ref_files;
      else if (typeof t.ref_files === 'string') {
        try { refFiles = JSON.parse(t.ref_files); } catch { }
      }

      const allDocs = caseData?.documents || [];
      const triggerDocs = allDocs.filter((d: any) =>
        d.doc_type === triggerTitle ||
        d.doc_type === `${triggerTitle}_photo` ||
        d.doc_type === `${triggerTitle}_doc`
      );

      const mergedRefFiles = [...refFiles, ...triggerDocs];

      return {
        title: triggerTitle,
        questions: questions,
        refFiles: mergedRefFiles,
        requiresPhoto: !!t.requires_photo || t.photo_required === 'Yes' || t.photo_required === true,
        requiresDocument: !!t.requires_document || t.document_required === 'Yes' || t.document_required === true
      };
    });

    return [
      {
        category: 'Checklist',
        theme: 'blue',
        items: items
      }
    ];
  }, [route.params?.triggerData, caseData?.checklist_config, caseData?.documents]);

  const flatTriggers = useMemo(() => {
    const arr: any[] = [];
    triggerData.forEach((cat: any) => {
      cat.items.forEach((item: any) => {
        arr.push(item);
      });
    });
    return arr;
  }, [triggerData]);

  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [triggerMasterStatus, setTriggerMasterStatus] = useState<Record<string, 'Positive' | 'Negative'>>({});
  const [remarks, setRemarks] = useState('');
  const [uploads, setUploads] = useState<Record<string, any[]>>({});
  const [explicitlyDone, setExplicitlyDone] = useState<Record<string, boolean>>({});

  const [uploadActionSheetVisible, setUploadActionSheetVisible] = useState(false);
  const [currentUploadContext, setCurrentUploadContext] = useState<{ docType: string, qKey?: string } | null>(null);


  const toggleItem = (title: string) => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setToggles(prev => ({ ...prev, [title]: !prev[title] }));
  };



  const handleUpload = (docType: string, qKey?: string) => {
    setCurrentUploadContext({ docType, qKey });
    setUploadActionSheetVisible(true);
  };

  const handleCamera = async (docType: string, qKey?: string) => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Camera permission is required');
          return;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo',
        cameraType: 'back',
        quality: 0.7,
        maxWidth: 800,
        maxHeight: 800,
      });
      if (result && !result.didCancel && result.assets && result.assets.length > 0) {
        // setUploads(prev => ({ ...prev, [docType]: [...(prev[docType] || []), result.assets![0]] }));
        // setUploadTimestamps(prev => ({ ...prev, [docType]: [...(prev[docType] || []), new Date().toISOString()] }));
        setUploads(prev => ({ ...prev, [currentUploadContext!.docType]: [...(prev[currentUploadContext!.docType] || []), result.assets![0]] }));
        setUploadTimestamps(prev => ({ ...prev, [docType]: [...(prev[docType] || []), new Date().toISOString()] }));
        if (qKey) {
          setAnswers(prev => ({ ...prev, [qKey!]: result.assets![0].fileName || 'Captured' }));
          const now = new Date().toISOString();
          setUploadTimestamps(prev => ({
            ...prev,
            [qKey!]: [...(prev[qKey!] || []), now],
          }));
        }
      }
    } catch (err) {
      console.log('Error opening camera:', err);
    }
  };

  const handleGallery = async (docType: string, qKey?: string) => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        selectionLimit: 1,
      });

      if (result && !result.didCancel && result.assets && result.assets.length > 0) {
        // setUploads(prev => ({ ...prev, [docType]: [...(prev[docType] || []), result.assets![0]] }));
        // setUploadTimestamps(prev => ({ ...prev, [docType]: [...(prev[docType] || []), new Date().toISOString()] }));
        setUploads(prev => ({ ...prev, [currentUploadContext!.docType]: [...(prev[currentUploadContext!.docType] || []), result.assets![0]] }));
        setUploadTimestamps(prev => ({ ...prev, [docType]: [...(prev[docType] || []), new Date().toISOString()] }));
        if (qKey) {
          setAnswers(prev => ({ ...prev, [qKey!]: result.assets![0].fileName || 'Selected from Gallery' }));
          const now = new Date().toISOString();
          setUploadTimestamps(prev => ({
            ...prev,
            [qKey!]: [...(prev[qKey!] || []), now],
          }));
        }
      }
    } catch (err) {
      console.log('Error opening gallery:', err);
    }
  };

  const handleAnswerChange = (title: string, qIdx: number, value: string) => {
    const qKey = `${title}_${qIdx}`;
    setAnswers(prev => ({ ...prev, [qKey]: value }));
    setExplicitlyDone(prev => ({ ...prev, [title]: false }));
  };

  const computedDoneTriggers = useMemo(() => {
    const statuses: Record<string, boolean> = {};
    if (!flatTriggers || flatTriggers.length === 0) return statuses;

    for (const item of flatTriggers) {
      const isDone = checkQuestionsFilled(item, answers, uploads);
      statuses[item.title] = isDone && !!(triggerMasterStatus && triggerMasterStatus[item.title]);
    }
    return statuses;
  }, [flatTriggers, answers, uploads, triggerMasterStatus]);

  const isAllFilled = useMemo(() => {
    if (!flatTriggers || flatTriggers.length === 0) return false;
    return flatTriggers.every((item: any) => computedDoneTriggers[item.title]);
  }, [flatTriggers, computedDoneTriggers]);

  const handleSubmit = async () => {
    const pendingTriggers = flatTriggers.filter((t: any) => !computedDoneTriggers[t.title] || !explicitlyDone[t.title]).map((t: any) => t.title);
    if (pendingTriggers.length > 0) {
      Alert.alert('Incomplete Triggers', `Please fill all data and click "Mark Done" for the following triggers:\n\n${pendingTriggers.join(', ')}`);
      return;
    }

    const formattedAnswers: Record<string, any> = {};

    flatTriggers.forEach((item: any) => {
      const itemAnswers: Record<string, string> = {};

      if (triggerMasterStatus[item.title]) {
        itemAnswers['Master Status'] = triggerMasterStatus[item.title];
      }

      item.questions.forEach((q: any, qIdx: number) => {
        const qKey = `${item.title}_${qIdx}`;
        let cleanText = q.text.replace(/^:\s*/, '');

        // Handle label collisions silently by appending index if needed
        if (itemAnswers[cleanText] !== undefined) {
          cleanText = `${cleanText} (${qIdx})`;
        }

        if (answers[qKey]) {
          itemAnswers[cleanText] = answers[qKey];
        }
        const sKey = `${qKey}_status`;
        if (answers[sKey]) {
          itemAnswers[`${cleanText} - Status`] = answers[sKey];
        }
        const rKey = `${qKey}_remarks`;
        if (answers[rKey]) {
          itemAnswers[`${cleanText} - Remarks`] = answers[rKey];
        }
        if (q.options) {
          const selectedOpt = q.options.find((o: any) => o.name === answers[qKey]);
          if (selectedOpt && selectedOpt.hasSub) {
            const subKey = `${qKey}_sub_${selectedOpt.subHeading}`;
            if (answers[subKey]) {
              itemAnswers[`${cleanText} - ${selectedOpt.subHeading}`] = answers[subKey];
            }
          }
        }
      });
      formattedAnswers[item.title] = itemAnswers;
    });

    try {
      // 1. Upload trigger photos/documents
      for (const [title, assets] of Object.entries(uploads)) {
        if (Array.isArray(assets)) {
          for (const asset of assets) {
            if (asset && asset.uri) {
              await uploadCaseDocument({
                id: caseId,
                fileData: {
                  uri: asset.uri,
                  type: asset.type || 'image/jpeg',
                  name: asset.fileName || 'trigger_upload.jpg'
                },
                doc_type: title
              }).unwrap();
            }
          }
        }
      }

      // 2. Submit trigger answers directly
      await submitFieldReport({
        caseId: caseId,
        formData: {
          gps_lat: 0,
          gps_lng: 0,
          status: 'submitted',
          remarks: remarks || 'Trigger verification completed.',
          checklist_results: {
            verified: true,
            coords: { latitude: 0, longitude: 0 },
            tasks: [],
            triggerAnswers: formattedAnswers,
            triggerStatuses: computedDoneTriggers,
            completedAt: new Date().toISOString(),
            ...formattedAnswers
          }
        }
      }).unwrap();

      Alert.alert(
        'Success',
        'Trigger report submitted successfully.',
        [
          { text: 'OK', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) }
        ]
      );
    } catch (err: any) {
      console.log('Error submitting trigger report:', err);
      const errMsg = err?.data?.message || err?.data?.error || err?.message || err?.error || (typeof err === 'object' ? JSON.stringify(err) : 'Failed to submit trigger report');
      Alert.alert('Error', typeof errMsg === 'object' ? JSON.stringify(errMsg) : String(errMsg));
    }
  };

  const handleCreateTrigger = async () => {
    if (!newTriggerTitle) {
      Alert.alert('Error', 'Please enter a trigger name');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Error', 'Please select a category first');
      return;
    }
    try {
      await createTrigger({ name: newTriggerTitle, category_id: selectedCategoryId }).unwrap();
      Alert.alert('Success', 'Trigger created');
      setNewTriggerTitle('');
      refetchTriggers();
    } catch (err: any) {
      console.log('Create Trigger Error:', err);
      if (err.status === 403) Alert.alert('Error', 'Insufficient permissions');
      else if (err.data && err.data.message) Alert.alert('Error', err.data.message);
      else Alert.alert('Error', 'Failed to create trigger');
    }
  };

  const handleDeleteTrigger = async (id: number) => {
    try {
      await deleteTrigger(id).unwrap();
      Alert.alert('Success', 'Trigger deleted');
      refetchTriggers();
    } catch (err: any) {
      if (err.status === 403) Alert.alert('Error', 'Insufficient permissions');
      else Alert.alert('Error', 'Failed to delete trigger');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName) return;
    try {
      await createCategory({ name: newCategoryName }).unwrap();
      Alert.alert('Success', 'Category created');
      setNewCategoryName('');
      refetchTriggers();
    } catch (err: any) {
      console.log('Create Category Error:', err);
      if (err.status === 403) Alert.alert('Error', 'Insufficient permissions');
      else if (err.data && err.data.message) Alert.alert('Error', err.data.message);
      else Alert.alert('Error', 'Failed to create category');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft color="#52525b" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Checklist</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => setShowAdminModal(true)}>
          <Settings color="#52525b" size={20} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <View style={styles.mainContainer}>
            <View style={styles.mainContainerHeader}>
              <Text style={styles.mainContainerTitle}>Checklist for Field Verifier {user?.email ? `(${user.email})` : ''}</Text>
            </View>

            <View style={styles.checklistList}>
              {flatTriggers.map((item: any, index: number) => (
                <TriggerCardItem
                  key={`trigger_${index}`}
                  item={item}
                  index={index}
                  isExpanded={toggles[item.title] === true}
                  triggerMasterStatus={triggerMasterStatus}
                  uploads={uploads}
                  uploadTimestamps={uploadTimestamps}
                  computedDone={computedDoneTriggers[item.title]}
                  explicitlyDone={explicitlyDone[item.title]}
                  answers={answers}
                  toggleItem={toggleItem}
                  setTriggerMasterStatus={setTriggerMasterStatus}
                  setExplicitlyDone={setExplicitlyDone}
                  handleCamera={handleCamera}
                  handleUpload={handleUpload}
                  handleAnswerChange={handleAnswerChange}
                  setAnswers={setAnswers}
                />
              ))}
            </View>
          </View>

          <View style={styles.bottomSection}>
            <Text style={styles.submitHeader}>Submit Field Report for Field Verifier {user?.email ? `(${user.email})` : ''}</Text>

            <View style={styles.remarksRow}>
              <Text style={styles.remarksTitle}>VERIFICATION REMARKS</Text>
              <TouchableOpacity style={styles.aiBtn}>
                <Sparkles size={14} color="#9333ea" />
                <Text style={styles.aiBtnText}>AUTO-GENERATE AI REPORT</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.remarksInput}
              placeholder="Please mark all triggers as 'Done' before submitting the field report."
              placeholderTextColor="#a1a1aa"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={remarks}
              onChangeText={setRemarks}
            />

            <TouchableOpacity
              style={[styles.submitBtn, (submitting || uploading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting || uploading}
            >
              {submitting || uploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Field Report →</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}

      {/* Admin Modal for Managing Triggers */}
      <Modal visible={showAdminModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowAdminModal(false)} style={styles.backBtn}>
              <ArrowLeft color="#52525b" size={20} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Manage Triggers (Admin)</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8 }}>Add New Trigger Category</Text>
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              <TextInput
                style={[styles.answerInput, { flex: 1, marginRight: 8 }]}
                placeholder="Category Name"
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <TouchableOpacity style={[styles.submitBtn, { paddingHorizontal: 16, marginTop: 0 }]} onPress={handleCreateCategory}>
                <Plus color="white" size={18} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8 }}>Add New Trigger</Text>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 10, color: '#475569', marginBottom: 6 }}>Select Category:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {(categoriesData?.data || []).map((cat: any) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 8 },
                      selectedCategoryId === cat.id && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text style={{ color: selectedCategoryId === cat.id ? 'white' : '#475569', fontSize: 9 }}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              <TextInput
                style={[styles.answerInput, { flex: 1, marginRight: 8 }]}
                placeholder="Trigger Name"
                value={newTriggerTitle}
                onChangeText={setNewTriggerTitle}
              />
              <TouchableOpacity style={[styles.submitBtn, { paddingHorizontal: 16, marginTop: 0 }]} onPress={handleCreateTrigger}>
                <Plus color="white" size={18} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 12 }}>Existing Triggers</Text>
            {triggersLoading ? <ActivityIndicator /> : (
              (allTriggersData?.data || allTriggersData || []).map((cat: any, i: number) => (
                <View key={i} style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: 'bold', color: '#334155', marginBottom: 8 }}>{cat.category || cat.name}</Text>
                  {(cat.items || cat.triggers || []).map((t: any, j: number) => (
                    <View key={j} style={[styles.triggerCard, { flexDirection: 'row', justifyContent: 'space-between', padding: 12 }]}>
                      <Text style={{ flex: 1, color: '#475569' }}>{t.title || t.name}</Text>
                      <TouchableOpacity onPress={() => handleDeleteTrigger(t.id)}>
                        <Trash color="#ef4444" size={16} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modern Upload Centered Modal */}
      <Modal
        visible={uploadActionSheetVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUploadActionSheetVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setUploadActionSheetVisible(false)}
        >
          <View style={{ width: '85%', backgroundColor: 'white', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 }} onStartShouldSetResponder={() => true}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 4, textAlign: 'center' }}>Upload Document</Text>
            <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 24, textAlign: 'center' }}>Choose how you want to upload</Text>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}
              onPress={() => {
                setUploadActionSheetVisible(false);
                setTimeout(() => {
                  if (currentUploadContext) handleCamera(currentUploadContext.docType, currentUploadContext.qKey);
                }, 300);
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Camera size={22} color="#2563eb" />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' }}
              onPress={() => {
                setUploadActionSheetVisible(false);
                setTimeout(async () => {
                  if (!currentUploadContext) return;
                  try {
                    const result = await launchImageLibrary({
                      mediaType: 'mixed',
                      selectionLimit: 1,
                      quality: 0.7,
                      maxWidth: 800,
                      maxHeight: 800,
                    });
                    if (result.assets && result.assets.length > 0) {
                      // setUploads(prev => ({ ...prev, [currentUploadContext.docType]: [...(prev[currentUploadContext.docType] || []), result.assets![0]] }));
                      setUploads(prev => ({ ...prev, [currentUploadContext.docType]: [...(prev[currentUploadContext.docType] || []), result.assets![0]] }));
                      setUploadTimestamps(prev => ({ ...prev, [currentUploadContext.docType]: [...(prev[currentUploadContext.docType] || []), new Date().toISOString()] }));
                      if (currentUploadContext.qKey) {
                        setAnswers(prev => ({ ...prev, [currentUploadContext.qKey!]: result.assets![0].fileName || 'Uploaded' }));
                      }
                    }
                  } catch (err) {
                    console.log('Error picking file:', err);
                  }
                }, 300);
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <FileText size={22} color="#2563eb" />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#fef2f2' }}
              onPress={() => setUploadActionSheetVisible(false)}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#ef4444' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const areTriggerPropsEqual = (prev: any, next: any) => {
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.triggerMasterStatus[prev.item.title] !== next.triggerMasterStatus[next.item.title]) return false;


  if (prev.uploads !== next.uploads) return false;

  if (prev.computedDone !== next.computedDone) return false;
  if (prev.explicitlyDone !== next.explicitlyDone) return false;

  for (let qIdx = 0; qIdx < prev.item.questions.length; qIdx++) {
    const qKey = `${prev.item.title}_${qIdx}`;
    if (prev.answers[qKey] !== next.answers[qKey]) return false;
    if (prev.answers[`${qKey}_remarks`] !== next.answers[`${qKey}_remarks`]) return false;
    if (prev.answers[`${qKey}_status`] !== next.answers[`${qKey}_status`]) return false;

    const q = prev.item.questions[qIdx];
    if (q.options) {
      for (const opt of q.options) {
        if (opt.hasSub) {
          const subKey = `${qKey}_sub_${opt.subHeading}`;
          if (prev.answers[subKey] !== next.answers[subKey]) return false;
        }
      }
    }
  }
  return true;
};

const checkQuestionsFilled = (item: any, answers: any, uploads: any) => {
  if (!item) return false;
  // Trigger-level upload is no longer mandatory, removed lines checking item.requiresPhoto

  if (item.questions && item.questions.length > 0) {
    for (let qIdx = 0; qIdx < item.questions.length; qIdx++) {
      const q = item.questions[qIdx];
      const qKey = `${item.title}_${qIdx}`;
      const val = answers[qKey];

      if (q.type !== 'table') {
        // Only require value if it's NOT a document upload
        if (q.type !== 'document') {
          if (!val) return false;

          if (q.type === 'yesno' && val === 'No') {
            if (!answers[`${qKey}_remarks`]) return false;
          }
          if (q.options) {
            const selectedOpt = q.options.find((o: any) => o.name === val);
            if (selectedOpt && selectedOpt.hasSub) {
              const subKey = `${qKey}_sub_${selectedOpt.subHeading}`;
              if (!answers[subKey]) return false;
            }
          }
        }

        // Status is always required, even if document is skipped
        if (!answers[`${qKey}_status`]) return false;
      }
    }
  }
  return true;
};

const TriggerCardItem = React.memo(({
  item, index, isExpanded, triggerMasterStatus, uploads, uploadTimestamps, computedDone, explicitlyDone, answers,
  toggleItem, setTriggerMasterStatus, setExplicitlyDone, handleCamera, handleUpload, handleAnswerChange, setAnswers
}: any) => {
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const isQuestionsFilled = useMemo(() => {
    return checkQuestionsFilled(item, answers, uploads);
  }, [item, answers, uploads]);

  return (
    <View style={[
      styles.triggerCard,
      isExpanded && styles.triggerCardExpanded,
      openDropdownKey ? { overflow: 'visible', zIndex: 1000, elevation: 1000 } : {}
    ]}>
      <TouchableOpacity
        style={styles.triggerHeaderRow}
        onPress={() => toggleItem(item.title)}
        activeOpacity={0.7}
      >
        <View style={styles.triggerHeaderLeft}>
          <Clock size={16} color="#64748b" />
          <Text style={styles.triggerTitle}>{item.title}</Text>
          {item.refFiles && item.refFiles.length > 0 && (
            <View style={styles.refFilesContainer}>
              {item.refFiles.map((doc: any, docIdx: number) => {
                const isPhoto = doc.doc_type?.endsWith('_photo');
                const isDoc = doc.doc_type?.endsWith('_doc');
                const label = isPhoto ? 'Ref Photo' : isDoc ? 'Ref Doc' : 'Ref File';
                const fileUrl = `${IMAGE_BASE_URL}/${doc.path ? doc.path.replace(/\\/g, '/').replace(/^public\//, '').replace(/^\//, '') : ''}`;
                return (
                  <TouchableOpacity
                    key={`ref_${docIdx}`}
                    style={styles.refFileBadge}
                    onPress={() => Linking.openURL(fileUrl).catch(() => { })}
                  >
                    <FileText size={10} color="#059669" />
                    <Text style={styles.refFileBadgeText}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        <View style={styles.triggerHeaderRight}>
          <View style={styles.masterStatusContainer}>
            <Text style={styles.masterStatusLabel}>STATUS:</Text>
            <TouchableOpacity
              style={styles.masterStatusRadio}
              disabled={!isQuestionsFilled}
              onPress={(e) => {
                e.stopPropagation();
                setTriggerMasterStatus((prev: any) => ({ ...prev, [item.title]: 'Positive' }));
                setExplicitlyDone((prev: any) => ({ ...prev, [item.title]: false }));
              }}
            >
              <View style={[styles.masterRadioCircle, triggerMasterStatus[item.title] === 'Positive' && styles.masterRadioCircleActive, !isQuestionsFilled && { borderColor: '#cbd5e1' }]} />
              <Text style={[styles.masterStatusText, triggerMasterStatus[item.title] === 'Positive' && styles.masterStatusTextPositive, !isQuestionsFilled && { color: '#94a3b8' }]}>Positive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.masterStatusRadio}
              disabled={!isQuestionsFilled}
              onPress={(e) => {
                e.stopPropagation();
                setTriggerMasterStatus((prev: any) => ({ ...prev, [item.title]: 'Negative' }));
                setExplicitlyDone((prev: any) => ({ ...prev, [item.title]: false }));
              }}
            >
              <View style={[styles.masterRadioCircle, triggerMasterStatus[item.title] === 'Negative' && styles.masterRadioCircleActiveNeg, !isQuestionsFilled && { borderColor: '#cbd5e1' }]} />
              <Text style={[styles.masterStatusText, triggerMasterStatus[item.title] === 'Negative' && styles.masterStatusTextNegative, !isQuestionsFilled && { color: '#94a3b8' }]}>Negative</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {uploads[item.title] && uploads[item.title].length > 0 && uploads[item.title].map((img: any, idx: number) => (
              <View key={idx} style={{ alignItems: 'center' }}>
                <Image source={{ uri: img.uri }} style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }} />
                {/* <Text style={{ fontSize: 7, color: '#94a3b8' }}>
                  {uploadTimestamps[item.title]?.[idx] ? new Date(uploadTimestamps[item.title][idx]).toLocaleTimeString() : ''}
                </Text> */}
              </View>
            ))}

            <>
              <TouchableOpacity
                style={[styles.uploadBtn, uploads[item.title] && uploads[item.title].length > 0 && styles.uploadBtnActive]}
                onPress={() => handleUpload(item.title)}
              >
                <Upload size={14} color={uploads[item.title] && uploads[item.title].length > 0 ? "#2563eb" : "#64748b"} />
                <Text style={[styles.uploadBtnText, uploads[item.title] && uploads[item.title].length > 0 && styles.uploadBtnTextActive]}>
                  Upload
                </Text>
              </TouchableOpacity>
            </>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              if (!computedDone) {
                Alert.alert('Incomplete', 'Please fill all fields and ensure a Status is selected for this trigger.');
              } else {
                setExplicitlyDone((prev: any) => ({ ...prev, [item.title]: !prev[item.title] }));
              }
            }}
            style={[styles.markDoneBtn, explicitlyDone && computedDone && styles.markDoneBtnActive]}
          >
            <Text style={[styles.markDoneBtnText, explicitlyDone && computedDone && styles.markDoneBtnTextActive]}>
              {explicitlyDone && computedDone ? 'Done' : 'Mark Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.triggerExpandedBody}>
          {item.questions.map((q: any, qIdx: number) => {
            const qKey = `${item.title}_${qIdx}`;
            return (
              <View
                style={[
                  styles.questionBlock,
                  openDropdownKey === qKey && { zIndex: 1000, elevation: 1000 }
                ]}
                key={qKey}
              >
                {q.type === 'table' ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 }}>
                      <View style={[styles.verifierBadge, { backgroundColor: '#faf5ff', marginBottom: 6 }]}>
                        <Text style={[styles.verifierBadgeText, { color: '#9333ea' }]}>VERIFIER TABLE</Text>
                      </View>
                      <Text style={[styles.questionMainText, { marginBottom: 0 }]}>{q.text}</Text>
                    </View>
                    {(() => {
                      const rawOptions = q.rawOptions || '';
                      const optionsArray = Array.isArray(rawOptions) ? rawOptions : (typeof rawOptions === 'string' ? rawOptions.split(',') : []);
                      const validCols = optionsArray.filter((c: any) => typeof c === 'string' && c.trim() !== '');

                      const allocCols = validCols.filter((c: string) => {
                        const cStr = c.trim();
                        const lastColon = cStr.lastIndexOf(':');
                        const target = lastColon > -1 ? cStr.substring(lastColon + 1).toLowerCase().trim() : 'allocator';
                        return target !== 'verify' && target !== 'verifier';
                      });

                      const verifyCols = validCols.filter((c: string) => {
                        const cStr = c.trim();
                        const lastColon = cStr.lastIndexOf(':');
                        const target = lastColon > -1 ? cStr.substring(lastColon + 1).toLowerCase().trim() : 'allocator';
                        return target === 'verify' || target === 'verifier' || target === 'both';
                      });

                      const tableData = (() => {
                        const raw = q.allocatorValue;
                        if (!raw) return [];
                        if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
                        return Array.isArray(raw) ? raw : [];
                      })();

                      const currentVerifyAnswers = Array.isArray(answers[qKey]) ? answers[qKey] : tableData.map(() => ({}));

                      return (
                        <View style={styles.tableContainer}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
                            <View>
                              {/* Header */}
                              <View style={styles.tableHeaderRow}>
                                {allocCols.map((col: string, idx: number) => (
                                  <View key={`ah-${idx}`} style={[styles.tableHeaderCell, styles.tableHeaderCellAlloc]}>
                                    <Text style={styles.tableHeaderText}>{col.trim().split(':')[0]}</Text>
                                    <Text style={styles.tableHeaderSubText}>(Alloc)</Text>
                                  </View>
                                ))}
                                {verifyCols.map((col: string, idx: number) => (
                                  <View key={`vh-${idx}`} style={[styles.tableHeaderCell, styles.tableHeaderCellVerify]}>
                                    <Text style={[styles.tableHeaderText, { color: '#9333ea' }]}>{col.trim().split(':')[0]}</Text>
                                    <Text style={[styles.tableHeaderSubText, { color: '#d8b4fe' }]}>(Verify)</Text>
                                  </View>
                                ))}
                              </View>

                              {/* Body */}
                              {tableData.length === 0 ? (
                                <View style={styles.tableEmptyRow}>
                                  <Text style={styles.tableEmptyText}>No allocator data available to verify.</Text>
                                </View>
                              ) : (
                                tableData.map((row: any, rIdx: number) => (
                                  <View key={`row-${rIdx}`} style={[styles.tableRow, rIdx % 2 === 1 && { backgroundColor: '#f8fafc' }]}>
                                    {allocCols.map((col: string, idx: number) => {
                                      const cName = col.trim().split(':')[0];
                                      return (
                                        <View key={`ac-${rIdx}-${idx}`} style={styles.tableCell}>
                                          {row[cName] ? (
                                            <Text style={styles.tableCellText}>{row[cName]}</Text>
                                          ) : (
                                            <Text style={styles.tableCellEmpty}>Not Filled</Text>
                                          )}
                                        </View>
                                      );
                                    })}
                                    {verifyCols.map((col: string, idx: number) => {
                                      const cName = col.trim().split(':')[0];
                                      return (
                                        <View key={`vc-${rIdx}-${idx}`} style={styles.tableCell}>
                                          <TextInput
                                            style={styles.tableInput}
                                            value={currentVerifyAnswers[rIdx]?.[cName] || ''}
                                            placeholder="Enter..."
                                            placeholderTextColor="#9ca3af"
                                            multiline={true}
                                            textAlignVertical="top"
                                            onChangeText={(t) => {
                                              const newAns = [...currentVerifyAnswers];
                                              newAns[rIdx] = { ...newAns[rIdx], [cName]: t };
                                              handleAnswerChange(item.title, qIdx, newAns);
                                            }}
                                          />
                                        </View>
                                      );
                                    })}
                                  </View>
                                ))
                              )}
                            </View>
                          </ScrollView>
                        </View>
                      );
                    })()}
                  </View>
                ) : (
                  <>
                    <Text style={styles.questionMainText}>{q.text}</Text>
                    <View style={styles.questionColumns}>
                      {/* Allocator Column */}
                      <View style={styles.allocatorColumn}>
                        <View style={styles.allocatorBadge}>
                          <Text style={styles.allocatorBadgeText}>ALLOCATOR FILL</Text>
                        </View>
                        {q.type === 'document' ? (
                          <View style={{ gap: 8 }}>
                            {(q.allocatorDocs && q.allocatorDocs.length > 0) ? q.allocatorDocs.map((doc: any, docIdx: number) => {
                              const valStr = String(doc.path);
                              let fullUrl = valStr;
                              if (valStr.startsWith('http') || valStr.startsWith('data:image') || valStr.startsWith('file://') || valStr.startsWith('content://')) {
                                if (valStr.includes('xcelrt.com') && !valStr.includes('/public/')) {
                                  fullUrl = valStr.replace('.com:8025/', '.com:8025/public/').replace('.com/', '.com/public/');
                                }
                              } else {
                                fullUrl = `${IMAGE_BASE_URL}/${valStr.split('\\\\').join('/').replace('public/', '').replace(new RegExp('^/'), '')}`;
                              }
                              return (
                                <TouchableOpacity
                                  key={docIdx}
                                  style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', height: 46 }}
                                  onPress={() => Linking.openURL(encodeURI(fullUrl)).catch(err => console.error("Couldn't open image URL:", err))}
                                >
                                  <View style={{ width: 28, height: 28, backgroundColor: '#e2e8f0', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {(valStr.startsWith('http') || valStr.startsWith('data:image') || valStr.startsWith('file://') || valStr.startsWith('content://') || valStr.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                                      <Image
                                        source={{ uri: encodeURI(fullUrl) }}
                                        style={{ width: 28, height: 28 }}
                                        resizeMode="cover"
                                      />
                                    ) : (
                                      <FileText size={14} color="#64748b" />
                                    )}
                                  </View>
                                  <Text style={{ fontSize: 10, color: '#2563eb', flex: 1 }} numberOfLines={1}>{doc.original_name || (valStr.split('/').pop() || 'image.png')}</Text>
                                </TouchableOpacity>
                              );
                            }) : q.allocatorValue ? (
                              <TouchableOpacity
                                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', height: 46 }}
                                onPress={() => {
                                  let valStr = String(q.allocatorValue);
                                  let fullUrl = valStr;
                                  if (valStr.startsWith('http') || valStr.startsWith('data:image') || valStr.startsWith('file://') || valStr.startsWith('content://')) {
                                    if (valStr.includes('xcelrt.com') && !valStr.includes('/public/')) {
                                      fullUrl = valStr.replace('.com:8025/', '.com:8025/public/').replace('.com/', '.com/public/');
                                    }
                                  } else {
                                    fullUrl = `${IMAGE_BASE_URL}/${valStr.split('\\\\').join('/').replace('public/', '').replace(new RegExp('^/'), '')}`;
                                  }
                                  Linking.openURL(encodeURI(fullUrl)).catch(err => console.error("Couldn't open image URL:", err));
                                }}
                              >
                                <View style={{ width: 28, height: 28, backgroundColor: '#e2e8f0', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {(String(q.allocatorValue).startsWith('http') || String(q.allocatorValue).startsWith('data:image') || String(q.allocatorValue).startsWith('file://') || String(q.allocatorValue).startsWith('content://') || String(q.allocatorValue).match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                                    <Image
                                      source={{
                                        uri: encodeURI(
                                          (String(q.allocatorValue).startsWith('http') || String(q.allocatorValue).startsWith('data:image') || String(q.allocatorValue).startsWith('file://') || String(q.allocatorValue).startsWith('content://'))
                                            ? (String(q.allocatorValue).includes('xcelrt.com') && !String(q.allocatorValue).includes('/public/')
                                              ? String(q.allocatorValue).replace('.com:8025/', '.com:8025/public/').replace('.com/', '.com/public/')
                                              : String(q.allocatorValue))
                                            : `${IMAGE_BASE_URL}/${String(q.allocatorValue).split('\\\\').join('/').replace('public/', '').replace(new RegExp('^/'), '')}`
                                        )
                                      }}
                                      style={{ width: 28, height: 28 }}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <FileText size={14} color="#64748b" />
                                  )}
                                </View>
                                <Text style={{ fontSize: 10, color: '#2563eb', flex: 1 }} numberOfLines={1}>{q.originalName || (q.allocatorValue ? (String(q.allocatorValue).split('/').pop() || 'image.png') : 'Not Filled')}</Text>
                              </TouchableOpacity>
                            ) : (
                              <TextInput
                                style={[styles.allocatorInput, { fontStyle: 'italic' }]}
                                placeholder="Not Filled"
                                placeholderTextColor="#9ca3af"
                                editable={false}
                                value=""
                              />
                            )}
                          </View>
                        ) : (
                          <TextInput
                            style={[styles.allocatorInput, !q.allocatorValue && { fontStyle: 'italic' }]}
                            placeholder="Not Filled"
                            placeholderTextColor="#9ca3af"
                            editable={false}
                            value={q.allocatorValue || ''}
                            multiline={true}
                          />
                        )}
                      </View>

                      {/* Verifier Column */}
                      <View style={styles.verifierColumn}>
                        <View style={{ marginBottom: 4, alignSelf: 'flex-start' }}>
                          <View style={styles.verifierBadge}>
                            <Text style={styles.verifierBadgeText}>VERIFIER FILL</Text>
                          </View>
                        </View>

                        {q.type === 'document' ? (
                          <View style={{ gap: 8, marginTop: 4 }}>
                            {(() => {
                              const docType = `${item.title}_${q.text.replace(/^:\\s*/, '')}`;
                              const uploadedFiles = uploads[docType] || [];
                              let configNum = q.subTriggerCount || 0;
                              if (!configNum && Array.isArray(q.options) && q.options.length > 0) {
                                configNum = q.options.length;
                              } else if (!configNum && q.options && !isNaN(Number(q.options)) && Number(q.options) > 0) {
                                configNum = Number(q.options);
                              }
                              const baseSlots = Math.max(configNum, q.allocatorDocs && q.allocatorDocs.length > 0 ? q.allocatorDocs.length : 1);
                              const numSlots = Math.max(baseSlots, uploadedFiles.length + 1);

                              return Array.from({ length: numSlots }).map((_, slotIdx) => {
                                const uploadedFile = uploadedFiles[slotIdx];
                                if (uploadedFile) {
                                  return (
                                    <View key={slotIdx} style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', height: 46 }}>
                                      <TouchableOpacity
                                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                                        onPress={() => setPreviewUri(uploadedFile.uri)}
                                      >
                                        <View style={{ width: 28, height: 28, backgroundColor: '#e2e8f0', borderRadius: 4, marginRight: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                          <Image
                                            source={{ uri: uploadedFile.uri }}
                                            style={{ width: 28, height: 28 }}
                                            resizeMode="cover"
                                          />
                                        </View>
                                        <Text style={{ fontSize: 10, color: '#2563eb', flex: 1 }} numberOfLines={1}>
                                          {uploadedFile.fileName || 'image.jpg'}
                                        </Text>
                                        <Text style={{ fontSize: 10, color: '#64748b', marginLeft: 8 }}>
                                          {uploadTimestamps[docType]?.[slotIdx] ? new Date(uploadTimestamps[docType][slotIdx]).toLocaleTimeString() : ''}
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  );
                                }
                                return (
                                  <View key={slotIdx}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                      <TouchableOpacity
                                        style={[styles.uploadBtn, answers[qKey] && styles.uploadBtnActive, { flex: 1, height: 46, justifyContent: 'center', borderRadius: 8 }]}
                                        onPress={() => handleUpload(docType, qKey)}
                                      >
                                        <Upload size={16} color={answers[qKey] ? "#2563eb" : "#475569"} />
                                        <Text style={[styles.uploadBtnText, answers[qKey] && styles.uploadBtnTextActive, { fontSize: 10, color: '#475569' }]}>
                                          Upload
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                    {(slotIdx === 0 && answers[qKey]) ? (
                                      <Text style={{ fontSize: 10, color: '#2563eb', paddingHorizontal: 4 }} numberOfLines={1}>
                                        Selected: {typeof answers[qKey] === 'string' ? answers[qKey] : JSON.stringify(answers[qKey])}
                                      </Text>
                                    ) : null}
                                  </View>
                                );
                              });
                            })()}
                          </View>
                        ) : q.type === 'dropdown' ? (
                          <View style={{ marginBottom: openDropdownKey === qKey ? 8 : 0 }}>
                            <TouchableOpacity
                              style={styles.dropdownSelector}
                              onPress={() => setOpenDropdownKey(openDropdownKey === qKey ? null : qKey)}
                            >
                              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.dropdownSelectorText, !answers[qKey] && { color: '#9ca3af' }]}>
                                {answers[qKey] || 'Select option...'}
                              </Text>
                              <ChevronDown size={16} color="#64748b" />
                            </TouchableOpacity>

                            {openDropdownKey === qKey && (
                              <View style={styles.dropdownList}>
                                <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                                  {q.options.map((optObj: any, oIdx: number) => (
                                    <TouchableOpacity
                                      key={`${qKey}_opt_${oIdx}`}
                                      style={[styles.dropdownOptionBtn, answers[qKey] === optObj.name && styles.dropdownOptionBtnActive]}
                                      onPress={() => {
                                        handleAnswerChange(item.title, qIdx, optObj.name);
                                        setOpenDropdownKey(null);
                                      }}
                                    >
                                      <Text style={[styles.dropdownOptionText, answers[qKey] === optObj.name && styles.dropdownOptionTextActive]}>
                                        {optObj.name}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}

                            {q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase() && o.hasSub) && (
                              <View style={styles.subFieldContainer}>
                                <Text style={styles.subFieldLabel}>
                                  {q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase())?.subHeading || 'REMARKS'}
                                </Text>
                                <TextInput
                                  style={styles.subFieldInput}
                                  placeholder="Enter sub-field answer..."
                                  placeholderTextColor="#9ca3af"
                                  value={answers[`${qKey}_sub_${q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase())?.subHeading || 'REMARKS'}`] || ''}
                                  onChangeText={(t) => setAnswers((prev: any) => ({ ...prev, [`${qKey}_sub_${q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase())?.subHeading || 'REMARKS'}`]: t }))}
                                />
                              </View>
                            )}
                          </View>
                        ) : (q.options && q.options.length > 0) ? (
                          <View style={styles.optionsContainer}>
                            <View style={styles.optionsWrap}>
                              {q.options.map((optObj: any, oIdx: number) => (
                                <TouchableOpacity
                                  key={`${qKey}_opt_${oIdx}`}
                                  style={[styles.optionBtn, answers[qKey] === optObj.name && styles.optionBtnActive]}
                                  onPress={() => handleAnswerChange(item.title, qIdx, optObj.name)}
                                >
                                  <View style={[styles.masterRadioCircle, answers[qKey] === optObj.name && styles.masterRadioCircleActive]} />
                                  <Text style={[styles.optionText, answers[qKey] === optObj.name && styles.optionTextActive]}>{optObj.name}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                            {q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase() && o.hasSub) && (
                              <View style={styles.subFieldContainer}>
                                <Text style={styles.subFieldLabel}>
                                  {q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase())?.subHeading || 'REMARKS'}
                                </Text>
                                <TextInput
                                  style={styles.subFieldInput}
                                  placeholder="Enter sub-field answer..."
                                  placeholderTextColor="#9ca3af"
                                  value={answers[`${qKey}_sub_${q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase())?.subHeading || 'REMARKS'}`] || ''}
                                  onChangeText={(t) => setAnswers((prev: any) => ({ ...prev, [`${qKey}_sub_${q.options.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase())?.subHeading || 'REMARKS'}`]: t }))}
                                />
                              </View>
                            )}
                          </View>
                        ) : (
                          <TextInput
                            style={styles.answerInput}
                            placeholder="Enter answer..."
                            placeholderTextColor="#9ca3af"
                            value={answers[qKey] || ''}
                            onChangeText={(t) => handleAnswerChange(item.title, qIdx, t)}
                          />
                        )}

                        {(!q.options?.find((o: any) => answers[qKey] && o.name && o.name.trim().toLowerCase() === String(answers[qKey]).trim().toLowerCase() && o.hasSub)) && (answers[qKey]?.toString().toLowerCase() === 'no') && (
                          <View style={styles.remarkContainer}>
                            <Text style={styles.remarkLabel}>REMARKS</Text>
                            <TextInput
                              style={styles.remarkInput}
                              placeholder="Enter remarks..."
                              placeholderTextColor="#9ca3af"
                              value={answers[`${qKey}_remarks`] || ''}
                              onChangeText={(t) => setAnswers((prev: any) => ({ ...prev, [`${qKey}_remarks`]: t }))}
                            />
                          </View>
                        )}

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', opacity: !answers[qKey] ? 0.4 : 1, pointerEvents: !answers[qKey] ? 'none' : 'auto' }}>
                          <Text style={[styles.inlineStatusLabel, { fontSize: 10 }]}>STATUS:</Text>
                          <TouchableOpacity
                            style={styles.inlineStatusRadio}
                            disabled={!answers[qKey]}
                            onPress={() => setAnswers((prev: any) => ({ ...prev, [`${qKey}_status`]: 'Positive' }))}
                          >
                            <View style={[styles.masterRadioCircle, answers[`${qKey}_status`] === 'Positive' && styles.masterRadioCircleActive, !answers[qKey] && { borderColor: '#cbd5e1' }]} />
                            <Text style={[styles.inlineStatusText, answers[`${qKey}_status`] === 'Positive' && styles.masterStatusTextPositive, !answers[qKey] && { color: '#94a3b8' }]}>Pos</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.inlineStatusRadio}
                            disabled={!answers[qKey]}
                            onPress={() => setAnswers((prev: any) => ({ ...prev, [`${qKey}_status`]: 'Negative' }))}
                          >
                            <View style={[styles.masterRadioCircle, answers[`${qKey}_status`] === 'Negative' && styles.masterRadioCircleActiveNeg, !answers[qKey] && { borderColor: '#cbd5e1' }]} />
                            <Text style={[styles.inlineStatusText, answers[`${qKey}_status`] === 'Negative' && styles.masterStatusTextNegative, !answers[qKey] && { color: '#94a3b8' }]}>Neg</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={!!previewUri} transparent={true} animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setPreviewUri(null)}>
          {previewUri && (
            <Image source={{ uri: previewUri }} style={{ width: '90%', height: '80%' }} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

    </View>
  );
}, areTriggerPropsEqual);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: { height: Platform.OS === 'android' ? 65 : 56, paddingTop: Platform.OS === 'android' ? 15 : 0, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', elevation: 1, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 11, fontWeight: '600', color: '#1e293b', marginTop: 13, letterSpacing: -0.3 },
  container: { padding: 12, paddingBottom: 40 },

  mainContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 24,
    marginTop: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  mainContainerHeader: {
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  mainContainerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1', // deeper sky blue for title
    letterSpacing: 0.2,
  },
  checklistList: {
    padding: 10,
  },
  triggerCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    marginBottom: 16,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  triggerCardExpanded: {
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.2,
    elevation: 5,
  },
  triggerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    flexWrap: 'wrap',
    rowGap: 12,
  },
  triggerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    flexWrap: 'wrap',
    rowGap: 4,
    minWidth: 150,
    marginRight: 12,
  },
  refFilesContainer: {
    flexDirection: 'row',
    marginLeft: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  refFileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  refFileBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#059669',
  },
  triggerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 6,
    flexShrink: 1,
    marginTop: -2,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  triggerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  masterStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  masterStatusLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    marginRight: 6,
    textTransform: 'uppercase',
  },
  masterStatusRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  masterRadioCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 4,
    backgroundColor: '#ffffff',
  },
  masterRadioCircleActive: {
    borderColor: '#10b981',
    borderWidth: 3,
  },
  masterRadioCircleActiveNeg: {
    borderColor: '#ef4444',
    borderWidth: 3,
  },
  masterStatusText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  masterStatusTextPositive: {
    color: '#10b981',
    fontWeight: '500',
  },
  masterStatusTextNegative: {
    color: '#ef4444',
    fontWeight: '500',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  uploadBtnActive: {
    borderColor: '#007AFF', // iOS blue
    backgroundColor: '#eff6ff',
  },
  uploadBtnText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginLeft: 4,
  },
  uploadBtnTextActive: {
    color: '#007AFF',
  },
  markDoneBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  markDoneBtnActive: {
    backgroundColor: '#dcfce7',
  },
  markDoneBtnText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  markDoneBtnTextActive: {
    color: '#16a34a',
  },
  triggerExpandedBody: {
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  questionBlock: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  questionMainText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  questionColumns: {
    flexDirection: 'column',
    gap: 8,
  },
  allocatorColumn: {
    flex: 1,
  },
  verifierColumn: {
    flex: 1,
  },
  allocatorBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  allocatorBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
  allocatorInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 9,
    color: '#64748b',
    backgroundColor: '#f8fafc',
    fontStyle: 'italic',
  },
  verifierHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 4
  },
  verifierBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifierBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9333ea',
  },
  inlineStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 1,
  },
  inlineStatusLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 4,
  },
  inlineStatusRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  inlineStatusText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  answerInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 9,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  dropdownSelectorText: {
    fontSize: 10,
    color: '#0f172a',
    flex: 1,
  },
  dropdownList: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    maxHeight: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dropdownOptionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  dropdownOptionBtnActive: {
    backgroundColor: '#eff6ff',
  },
  dropdownOptionText: {
    fontSize: 9,
    color: '#475569',
  },
  dropdownOptionTextActive: {
    color: '#007AFF', // iOS blue
    fontWeight: '600', // slightly bolder for native feel
  },
  remarksRequiredContainer: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#e9d5ff',
  },
  remarksRequiredLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9333ea',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  remarksRequiredInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    color: '#334155',
    fontSize: 10,
    minHeight: 36,
  },
  optionsContainer: {
    gap: 8,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  optionBtnActive: {
    borderColor: '#007AFF', // iOS blue
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#007AFF', // iOS blue
    fontWeight: '600',
  },
  subFieldContainer: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#fecaca',
  },
  subFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ef4444',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subFieldInput: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 10,
    color: '#334155',
    backgroundColor: '#ffffff',
  },
  tableContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tableHeaderCellAlloc: {
    backgroundColor: '#f0fdf4',
  },
  tableHeaderCellVerify: {
    backgroundColor: '#faf5ff',
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderSubText: {
    fontSize: 10,
    textTransform: 'uppercase',
    marginLeft: 6,
    color: '#4ade80',
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  tableCell: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 160,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '500',
  },
  tableCellEmpty: {
    fontSize: 10,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  tableInput: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 9,
    minHeight: 60,
    backgroundColor: '#ffffff',
    color: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tableEmptyRow: {
    padding: 12,
    alignItems: 'center',
  },
  tableEmptyText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#94a3b8',
  },
  remarkContainer: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#fecaca',
  },
  remarkLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ef4444',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  remarkInput: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 10,
    color: '#334155',
    backgroundColor: '#fef2f2',
  },
  bottomSection: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    marginBottom: 20,
    marginTop: 10,
  },
  submitHeader: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  remarksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  remarksTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 6,
  },
  aiBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7e22ce',
    marginLeft: 4,
  },
  remarksInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    fontSize: 10,
    color: '#0f172a',
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  submitBtnDisabled: {
    backgroundColor: '#cbd5e1',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
