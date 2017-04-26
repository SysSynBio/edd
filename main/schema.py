import graphene

from graphene_django.types import DjangoObjectType

from main.models import Study, Line


class StudyType(DjangoObjectType):
    class Meta:
        model = Study


class LineType(DjangoObjectType):
    class Meta:
        model = Line


class Query(graphene.AbstractType):
    all_studies = graphene.List(StudyType)
    all_lines = graphene.List(LineType)

    def resolve_all_studies(self, args, context, info):
        return Study.objects.all()

    def resolve_all_lines(self, args, context, info):
        # We can easily optimize query count in the resolve method
        return Line.objects.select_related('lines').all()
