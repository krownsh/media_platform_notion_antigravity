import { useNavigate } from 'react-router-dom';

const ImageWorkflowPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-[rgba(0,0,0,0.95)] p-8 text-center">
            <h1 className="text-xl font-bold">AI Image Workflow 已停用</h1>
            <p className="mt-3 text-[#615d59]">此功能的影像供應商已移除，尚未設定替代方案。</p>
            <button onClick={() => navigate(-1)} className="mt-6 px-4 py-2 rounded bg-[#0075de] text-white">
                返回
            </button>
        </div>
    );
};

export default ImageWorkflowPage;
