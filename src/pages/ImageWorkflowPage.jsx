import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, Play, Save, Loader2, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import RichMentionEditor from '../components/RichMentionEditor';

const ImageWorkflowPage = () => {
    const { postId } = useParams();
    const navigate = useNavigate();
    const { items } = useSelector((state) => state.posts);
    const post = items.find(p => p.id === postId || p.dbId === postId);

    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [logId, setLogId] = useState(null);

    // Step 1 State
    const [step1Prompt, setStep1Prompt] = useState(`Act as an expert instructional designer. Analyze the attached image.

Ignore the artistic style. (Do not describe colors, fonts, or art style).

Extract the core teaching logic. What is being taught? What are the key steps, hierarchy, or relationships shown?

Output the pure content as a structured list or bullet points in English. This will be the base for a new creation.`);
    const [step1Output, setStep1Output] = useState('');

    // Step 2 State
    const [step2Prompt, setStep2Prompt] = useState(`Now, take the extracted content and strictly follow these two tasks:

Task A: Content Rewrite Rewrite the educational content to be [Insert your preference: e.g., simpler, more professional, funny, summarized].

Task B: Visual Translation for AI Image Generator Create a 'Subject-Only' description for an AI image generator based on the rewritten content.

Describe the visual subject (e.g., 'a diagram showing...', 'a character doing...', 'an exploded view of...').

DO NOT include style words (e.g., do not say 'cartoon', 'realistic', 'watercolor'). Keep it neutral.

Focus on composition and objects.

[Extracted Content]:
{{STEP1_OUTPUT}}

Output format: Just give me the Subject Description paragraph in English.`);
    const [step2Output, setStep2Output] = useState('');

    // Step 3 State
    const [styleKeywords, setStyleKeywords] = useState('Flat vector art style, minimalism, pastel color palette');
    const [qualityModifiers, setQualityModifiers] = useState('white background, clean layout, knolling, 8k resolution, high quality, textless --ar 2:3');
    // Step 3 Prompt Template (Hidden/Advanced) - combining style, subject, quality
    const [step3Prompt, setStep3Prompt] = useState(`{{STYLE_KEYWORDS}}, {{STEP2_OUTPUT}}, {{QUALITY_MODIFIERS}}`);
    const [step3Output, setStep3Output] = useState('');

    // Helper to insert variable at cursor
    const insertVariable = (elementId, variableName, setPromptState) => {
        const textarea = document.getElementById(elementId);
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const newText = text.substring(0, start) + variableName + text.substring(end);

        setPromptState(newText);

        // Restore focus and cursor (timeout needed for React re-render)
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + variableName.length, start + variableName.length);
        }, 0);
    };

    // Load history if available
    useEffect(() => {
        if (postId) {
            fetch(`${API_BASE_URL}/api/posts/${postId}/image-workflows`)
                .then(res => res.json())
                .then(data => {
                    if (data.logs && data.logs.length > 0) {
                        const lastLog = data.logs[0];
                        setLogId(lastLog.id);
                        if (lastLog.step_1_output) {
                            setStep1Output(lastLog.step_1_output);
                            setStep1Prompt(lastLog.step_1_prompt || step1Prompt);
                            setCurrentStep(2);
                        }
                        if (lastLog.step_2_output) {
                            setStep2Output(lastLog.step_2_output);
                            setStep2Prompt(lastLog.step_2_prompt || step2Prompt);
                            setCurrentStep(3);
                        }
                        if (lastLog.step_3_output) {
                            setStep3Output(lastLog.step_3_output);
                            // Parse style/quality if possible, or just leave defaults
                        }
                    }
                })
                .catch(err => console.error('Failed to load history:', err));
        }
    }, [postId]);

    const handleStep1 = async () => {
        if (!post?.images?.[0]) return alert('No image found in post');
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/image-workflow/step1`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId,
                    userId: 'user-id-placeholder', // In real app, get from auth context
                    imageUrl: post.images[0],
                    prompt: step1Prompt
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setStep1Output(data.output);
            setLogId(data.logId);
            setCurrentStep(2);
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStep2 = async () => {
        if (!step1Output) return alert('Step 1 output is missing');
        setLoading(true);

        // Frontend Substitution
        const finalPrompt = step2Prompt.replace('{{STEP1_OUTPUT}}', step1Output);

        try {
            const res = await fetch(`${API_BASE_URL}/api/image-workflow/step2`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logId,
                    content: step1Output, // Still sending content for logging/reference if needed
                    prompt: finalPrompt   // Sending the FULLY SUBSTITUTED prompt
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setStep2Output(data.output);
            setCurrentStep(3);
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStep3 = async () => {
        if (!step2Output) return alert('Step 2 output is missing');

        // Cost Warning Check
        if (!window.confirm("Warning: This operation uses the 'Nano Banana Pro' model which may incur higher costs (~$0.06/image). Do you want to proceed?")) {
            return;
        }

        setLoading(true);

        // Frontend Substitution for Step 3
        let finalPrompt = step3Prompt
            .replace('{{STYLE_KEYWORDS}}', styleKeywords)
            .replace('{{STEP2_OUTPUT}}', step2Output)
            .replace('{{QUALITY_MODIFIERS}}', qualityModifiers);

        try {
            const res = await fetch(`${API_BASE_URL}/api/image-workflow/step3`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logId,
                    prompt: finalPrompt // Send the full prompt
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setStep3Output(data.output); // This will now be an image URL
            setCurrentStep(4); // Advance to Step 4
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Step 4 State
    const [selectedPlatforms, setSelectedPlatforms] = useState({
        instagram: false,
        threads: false,
        twitter: false
    });
    const [finalCaption, setFinalCaption] = useState('');
    const [publishStatus, setPublishStatus] = useState('');

    // Auto-fill caption from Step 2 output when entering Step 4
    useEffect(() => {
        if (step2Output && !finalCaption) {
            setFinalCaption(step2Output);
        }
    }, [step2Output]);

    const handlePublish = async () => {
        if (!step3Output) return alert('No image generated yet!');

        setLoading(true);
        setPublishStatus('Starting publication...\n');

        const appendStatus = (msg) => setPublishStatus(prev => prev + msg + '\n');

        try {
            // Instagram
            if (selectedPlatforms.instagram) {
                appendStatus('⏳ Publishing to Instagram...');
                try {
                    const res = await fetch(`${API_BASE_URL}/api/publish/instagram`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: step3Output, caption: finalCaption })
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    appendStatus(`✅ Instagram: Published! ID: ${data.id}`);
                } catch (e) {
                    appendStatus(`❌ Instagram Failed: ${e.message}`);
                }
            }

            // Threads
            if (selectedPlatforms.threads) {
                appendStatus('⏳ Publishing to Threads...');
                try {
                    const res = await fetch(`${API_BASE_URL}/api/publish/threads`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ imageUrl: step3Output, text: finalCaption })
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    appendStatus(`✅ Threads: Published! ID: ${data.id}`);
                } catch (e) {
                    appendStatus(`❌ Threads Failed: ${e.message}`);
                }
            }

            // Twitter
            if (selectedPlatforms.twitter) {
                appendStatus('⏳ Publishing to Twitter...');
                try {
                    const res = await fetch(`${API_BASE_URL}/api/publish/twitter`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: finalCaption + `\n\nImage: ${step3Output}` }) // Append image URL for now
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    appendStatus(`✅ Twitter: Published! ID: ${data.id}`);
                } catch (e) {
                    appendStatus(`❌ Twitter Failed: ${e.message}`);
                }
            }

            appendStatus('✨ All operations completed.');

        } catch (error) {
            appendStatus(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!post) return <div className="p-8 text-center">Post not found</div>;

    return (
        <div className="min-h-screen bg-background text-foreground p-6 pb-32">
            {/* Header */}
            <div className="max-w-5xl mx-auto mb-8 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-accent/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold">AI Image Workflow</h1>
            </div>

            <div className="max-w-5xl mx-auto space-y-12">

                {/* Step 1 */}
                <section className={`glass-card p-6 rounded-3xl border ${currentStep === 1 ? 'border-accent ring-2 ring-accent/20' : 'border-white/10'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                            拆解與提取 (Extract Logic)
                        </h2>
                        {step1Output && <CheckCircle className="text-green-500" size={24} />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="aspect-video bg-black/5 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
                                {post.images && post.images[0] ? (
                                    <img src={post.images[0]} alt="Source" className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-muted-foreground">No Image</span>
                                )}
                            </div>
                            <label className="block text-sm font-medium text-muted-foreground">Prompt 1 (Editable)</label>
                            <textarea
                                value={step1Prompt}
                                onChange={(e) => setStep1Prompt(e.target.value)}
                                className="w-full h-48 bg-white/50 border border-white/20 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Analysis Result</label>
                            <textarea
                                value={step1Output}
                                onChange={(e) => setStep1Output(e.target.value)}
                                placeholder="Result will appear here..."
                                className="w-full h-[340px] bg-black/5 border border-white/10 rounded-xl p-4 text-sm font-mono focus:outline-none resize-none"
                            />
                            <button
                                onClick={handleStep1}
                                disabled={loading}
                                className="w-full bg-accent hover:bg-accent/90 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
                            >
                                {loading && currentStep === 1 ? <Loader2 className="animate-spin" /> : <Play size={18} />}
                                Run Step 1
                            </button>
                        </div>
                    </div>
                </section>

                {/* Step 2 */}
                <section className={`glass-card p-6 rounded-3xl border ${currentStep === 2 ? 'border-accent ring-2 ring-accent/20' : 'border-white/10'} ${currentStep < 2 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                            改寫與視覺轉譯 (Rewrite & Translate)
                        </h2>
                        {step2Output && <CheckCircle className="text-green-500" size={24} />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Prompt 2 (Instructions)</label>
                            <RichMentionEditor
                                value={step2Prompt}
                                onChange={setStep2Prompt}
                                variables={[
                                    { label: 'Step 1 Result', value: '{{STEP1_OUTPUT}}' }
                                ]}
                                placeholder="Type @ to insert Step 1 Result..."
                                minHeight="200px"
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Visual Translation (Step 2 Output)</h3>
                                {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>}
                            </div>
                            <div className="bg-muted/30 p-4 rounded-xl border border-white/10 min-h-[100px] text-sm whitespace-pre-wrap">
                                {step2Output || "Result will appear here..."}
                            </div>
                            <button
                                onClick={handleStep2}
                                disabled={loading || !step1Output}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Play size={18} fill="currentColor" />
                                Run Step 2
                            </button>
                        </div>
                    </div>
                </section>

                {/* Step 3 */}
                <section className={`glass-card p-6 rounded-3xl border ${currentStep === 3 ? 'border-accent ring-2 ring-accent/20' : 'border-white/10'} ${currentStep < 3 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                            組合與生成 (Combine & Generate)
                        </h2>
                        {step3Output && <CheckCircle className="text-green-500" size={24} />}
                    </div>

                    <div className="space-y-6">
                        {/* Advanced Template Editor */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-muted-foreground">Prompt Template (Advanced)</label>
                            <RichMentionEditor
                                value={step3Prompt}
                                onChange={setStep3Prompt}
                                variables={[
                                    { label: 'Style', value: '{{STYLE_KEYWORDS}}' },
                                    { label: 'Subject (Step 2)', value: '{{STEP2_OUTPUT}}' },
                                    { label: 'Quality', value: '{{QUALITY_MODIFIERS}}' }
                                ]}
                                placeholder="Type @ to insert variables..."
                                minHeight="100px"
                                className="border-gray-300 shadow-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Type @ to insert variables. They will be replaced by the values below.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Style Keywords</label>
                                <input
                                    type="text"
                                    value={styleKeywords}
                                    onChange={(e) => setStyleKeywords(e.target.value)}
                                    className="w-full bg-white/50 border border-white/20 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-muted-foreground">Quality Modifiers</label>
                                <input
                                    type="text"
                                    value={qualityModifiers}
                                    onChange={(e) => setQualityModifiers(e.target.value)}
                                    className="w-full bg-white/50 border border-white/20 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Generated Image</label>
                            <div className="relative min-h-[300px] bg-black/5 border border-white/10 rounded-xl overflow-hidden flex items-center justify-center">
                                {step3Output && step3Output.startsWith('http') ? (
                                    <img src={step3Output} alt="Generated" className="w-full h-full object-contain" />
                                ) : (
                                    <div className="text-muted-foreground p-4 text-center">
                                        {step3Output || "Image will appear here..."}
                                    </div>
                                )}
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-yellow-600 font-medium text-sm mb-2">
                                ⚠️ Cost Warning: Generating images with Nano Banana Pro (Flux Pro 1.1 Ultra) costs approximately $0.06 per image.
                            </div>

                            <button
                                onClick={handleStep3}
                                disabled={loading}
                                className="w-full bg-accent hover:bg-accent/90 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
                            >
                                {loading && currentStep === 3 ? <Loader2 className="animate-spin" /> : <Play size={18} />}
                                Generate Image with Nano Banana Pro
                            </button>
                        </div>
                    </div>
                </section>

                {/* Step 4: Publish */}
                <section className={`glass-card p-6 rounded-3xl border ${currentStep === 4 ? 'border-accent ring-2 ring-accent/20' : 'border-white/10'} ${currentStep < 4 ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <span className="bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
                            發佈 (Publish)
                        </h2>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Instagram Toggle */}
                            <div className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedPlatforms.instagram ? 'bg-pink-500/10 border-pink-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                onClick={() => setSelectedPlatforms(prev => ({ ...prev, instagram: !prev.instagram }))}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedPlatforms.instagram ? 'bg-pink-500 border-pink-500' : 'border-white/30'}`}>
                                        {selectedPlatforms.instagram && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                    <span className="font-medium">Instagram</span>
                                </div>
                                <p className="text-xs text-muted-foreground pl-8">Post image + caption</p>
                            </div>

                            {/* Threads Toggle */}
                            <div className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedPlatforms.threads ? 'bg-white/20 border-white' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                onClick={() => setSelectedPlatforms(prev => ({ ...prev, threads: !prev.threads }))}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedPlatforms.threads ? 'bg-white border-white' : 'border-white/30'}`}>
                                        {selectedPlatforms.threads && <CheckCircle size={14} className="text-black" />}
                                    </div>
                                    <span className="font-medium">Threads</span>
                                </div>
                                <p className="text-xs text-muted-foreground pl-8">Post image + text</p>
                            </div>

                            {/* Twitter Toggle */}
                            <div className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedPlatforms.twitter ? 'bg-blue-500/10 border-blue-500' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                onClick={() => setSelectedPlatforms(prev => ({ ...prev, twitter: !prev.twitter }))}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedPlatforms.twitter ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}>
                                        {selectedPlatforms.twitter && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                    <span className="font-medium">Twitter / X</span>
                                </div>
                                <p className="text-xs text-muted-foreground pl-8">Post text only (Basic Tier)</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-muted-foreground">Final Caption / Text</label>
                            <textarea
                                value={finalCaption}
                                onChange={(e) => setFinalCaption(e.target.value)}
                                className="w-full h-32 bg-white/50 border border-white/20 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                                placeholder="Enter the caption for your post..."
                            />
                        </div>

                        <button
                            onClick={handlePublish}
                            disabled={loading || (!selectedPlatforms.instagram && !selectedPlatforms.threads && !selectedPlatforms.twitter)}
                            className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            Publish to Selected Platforms
                        </button>

                        {publishStatus && (
                            <div className="p-4 rounded-xl bg-black/20 border border-white/10 text-sm whitespace-pre-wrap font-mono">
                                {publishStatus}
                            </div>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
};

export default ImageWorkflowPage;
