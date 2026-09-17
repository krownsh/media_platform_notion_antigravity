import React from 'react';
import { useParams } from 'react-router-dom';
import KnowledgeSpaceMap from '../components/KnowledgeSpaceMap';

export default function KnowledgeSpacePage() {
  const { spaceId } = useParams();
  return (
    <div className="flow-page px-1 pt-5 sm:px-2 sm:pt-8 md:pt-12">
      <KnowledgeSpaceMap spaceId={spaceId} />
    </div>
  );
}
